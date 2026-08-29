#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol};

// --- Contract 1: Reward Token Contract ---
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct RewardBalance {
    pub owner: Address,
    pub amount: i128,
}

#[contract]
pub struct RewardTokenContract;

#[contractimpl]
impl RewardTokenContract {
    pub fn mint(env: Env, to: Address, amount: i128) -> i128 {
        let mut current_balance: i128 = env
            .storage()
            .persistent()
            .get(&to)
            .unwrap_or(0);
        current_balance += amount;
        env.storage().persistent().set(&to, &current_balance);
        env.events().publish((symbol_short!("token"), symbol_short!("minted")), (to, amount));
        current_balance
    }

    pub fn balance_of(env: Env, owner: Address) -> i128 {
        env.storage().persistent().get(&owner).unwrap_or(0)
    }
}

// --- Contract 2: REC Marketplace Contract (Inter-Contract Communication) ---
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct RecItem {
    pub id: u64,
    pub amount_mwh: u32,
    pub price_stroops: i64,
    pub source: Symbol,
    pub owner: Address,
    pub is_sold: bool,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct EscrowItem {
    pub id: u64,
    pub buyer: Address,
    pub seller: Address,
    pub amount_stroops: i64,
    pub release_ledger: u32,
    pub is_completed: bool,
    pub is_refunded: bool,
}

#[contracttype]
pub enum DataKey {
    Admin,
    RewardTokenContract,
    RecCount,
    Rec(u64),
    Escrow(u64),
}

#[contract]
pub struct RecMarketplaceContract;

#[contractimpl]
impl RecMarketplaceContract {
    pub fn initialize(env: Env, admin: Address, reward_token_contract: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::RewardTokenContract, &reward_token_contract);
        env.storage().instance().set(&DataKey::RecCount, &0u64);
    }

    pub fn create_rec(
        env: Env,
        creator: Address,
        id: u64,
        amount_mwh: u32,
        price_stroops: i64,
        source: Symbol,
    ) -> bool {
        creator.require_auth();

        if env.storage().persistent().has(&DataKey::Rec(id)) {
            panic!("REC ID already exists");
        }

        let item = RecItem {
            id,
            amount_mwh,
            price_stroops,
            source,
            owner: creator.clone(),
            is_sold: false,
        };

        env.storage().persistent().set(&DataKey::Rec(id), &item);

        let count: u64 = env.storage().instance().get(&DataKey::RecCount).unwrap_or(0);
        env.storage().instance().set(&DataKey::RecCount, &(count + 1));

        env.events().publish((symbol_short!("rec"), symbol_short!("created")), (id, amount_mwh, price_stroops));
        true
    }

    // Inter-contract call: Calls RewardTokenContract::mint upon purchasing REC
    pub fn buy_rec(env: Env, buyer: Address, id: u64) -> bool {
        buyer.require_auth();

        let mut item: RecItem = env
            .storage()
            .persistent()
            .get(&DataKey::Rec(id))
            .unwrap_or_else(|| panic!("REC not found"));

        if item.is_sold {
            panic!("REC is already sold");
        }

        item.is_sold = true;
        item.owner = buyer.clone();
        env.storage().persistent().set(&DataKey::Rec(id), &item);

        // Perform Inter-Contract Invocation to RewardTokenContract
        if let Some(reward_contract_id) = env.storage().instance().get::<_, Address>(&DataKey::RewardTokenContract) {
            let client = RewardTokenContractClient::new(&env, &reward_contract_id);
            client.mint(&buyer, &10_000_000); // Mint 10 RECT Reward tokens to buyer
        }

        env.events().publish((symbol_short!("rec"), symbol_short!("purchased")), (id, buyer));
        true
    }

    pub fn get_rec(env: Env, id: u64) -> Option<RecItem> {
        env.storage().persistent().get(&DataKey::Rec(id))
    }

    pub fn get_rec_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::RecCount).unwrap_or(0)
    }

    // --- Escrow Lockup & Refund System ---
    pub fn create_escrow(
        env: Env,
        buyer: Address,
        seller: Address,
        escrow_id: u64,
        amount_stroops: i64,
        lock_period_ledger_count: u32,
    ) -> bool {
        buyer.require_auth();

        if env.storage().persistent().has(&DataKey::Escrow(escrow_id)) {
            panic!("Escrow ID already exists");
        }

        let current_ledger = env.ledger().sequence();
        let release_ledger = current_ledger + lock_period_ledger_count;

        let escrow = EscrowItem {
            id: escrow_id,
            buyer: buyer.clone(),
            seller: seller.clone(),
            amount_stroops,
            release_ledger,
            is_completed: false,
            is_refunded: false,
        };

        env.storage().persistent().set(&DataKey::Escrow(escrow_id), &escrow);
        env.events().publish((symbol_short!("escrow"), symbol_short!("created")), (escrow_id, buyer, seller, amount_stroops));
        true
    }

    pub fn release_escrow(env: Env, buyer: Address, escrow_id: u64) -> bool {
        buyer.require_auth();

        let mut escrow: EscrowItem = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(escrow_id))
            .unwrap_or_else(|| panic!("Escrow not found"));

        if escrow.is_completed || escrow.is_refunded {
            panic!("Escrow already settled");
        }

        if escrow.buyer != buyer {
            panic!("Unauthorized buyer");
        }

        escrow.is_completed = true;
        env.storage().persistent().set(&DataKey::Escrow(escrow_id), &escrow);

        env.events().publish((symbol_short!("escrow"), symbol_short!("released")), (escrow_id, escrow.seller.clone()));
        true
    }

    pub fn refund_escrow(env: Env, caller: Address, escrow_id: u64) -> bool {
        caller.require_auth();

        let mut escrow: EscrowItem = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(escrow_id))
            .unwrap_or_else(|| panic!("Escrow not found"));

        if escrow.is_completed || escrow.is_refunded {
            panic!("Escrow already settled");
        }

        let current_ledger = env.ledger().sequence();
        if current_ledger < escrow.release_ledger && caller != escrow.seller {
            panic!("Lock period not expired and caller is not seller");
        }

        escrow.is_refunded = true;
        env.storage().persistent().set(&DataKey::Escrow(escrow_id), &escrow);

        env.events().publish((symbol_short!("escrow"), symbol_short!("refunded")), (escrow_id, escrow.buyer.clone()));
        true
    }

    pub fn get_escrow(env: Env, escrow_id: u64) -> Option<EscrowItem> {
        env.storage().persistent().get(&DataKey::Escrow(escrow_id))
    }
}

#[cfg(test)]
mod test;
