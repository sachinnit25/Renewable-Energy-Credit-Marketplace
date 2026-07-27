#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol};

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
    RecCount,
    Rec(u64),
}

#[contract]
pub struct RecMarketplaceContract;

#[contractimpl]
impl RecMarketplaceContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
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
