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
pub enum DataKey {
    Admin,
    RewardTokenContract,
    RecCount,
    Rec(u64),
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
}

#[cfg(test)]
mod test;
