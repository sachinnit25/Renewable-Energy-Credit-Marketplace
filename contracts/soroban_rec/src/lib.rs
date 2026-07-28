#![no_std]
use soroban_sdk::{contract, contractclient, contractimpl, contracttype, symbol_short, Address, Env, Symbol};

// Inter-contract Interface definition for external REC Verifier / Registry Contract
#[contractclient(name = "ExternalRegistryClient")]
pub trait ExternalRegistryInterface {
    fn verify_certificate(env: Env, rec_id: u64, amount_mwh: u32) -> bool;
    fn record_retirement(env: Env, rec_id: u64, owner: Address) -> bool;
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum RecStatus {
    Active,
    Sold,
    Retired,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct RecItem {
    pub id: u64,
    pub amount_mwh: u32,
    pub price_stroops: i64,
    pub source: Symbol,
    pub owner: Address,
    pub is_sold: bool,
    pub is_retired: bool,
}

#[contracttype]
pub enum DataKey {
    Admin,
    RecCount,
    Rec(u64),
    RegistryContract,
    RetirementCount,
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
        env.storage().instance().set(&DataKey::RetirementCount, &0u64);
    }

    pub fn set_registry_contract(env: Env, registry: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::RegistryContract, &registry);
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
            is_retired: false,
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
        if item.is_retired {
            panic!("REC is retired");
        }

        item.is_sold = true;
        item.owner = buyer.clone();
        env.storage().persistent().set(&DataKey::Rec(id), &item);

        env.events().publish((symbol_short!("rec"), symbol_short!("purchased")), (id, buyer));
        true
    }

    pub fn retire_rec(env: Env, owner: Address, id: u64) -> bool {
        owner.require_auth();

        let mut item: RecItem = env
            .storage()
            .persistent()
            .get(&DataKey::Rec(id))
            .unwrap_or_else(|| panic!("REC not found"));

        if item.owner != owner {
            panic!("Not REC owner");
        }
        if item.is_retired {
            panic!("REC is already retired");
        }

        item.is_retired = true;
        env.storage().persistent().set(&DataKey::Rec(id), &item);

        // Perform Inter-contract invocation if Registry Contract address is configured
        if let Some(registry_addr) = env.storage().instance().get::<DataKey, Address>(&DataKey::RegistryContract) {
            let client = ExternalRegistryClient::new(&env, &registry_addr);
            client.record_retirement(&id, &owner);
        }

        let ret_count: u64 = env.storage().instance().get(&DataKey::RetirementCount).unwrap_or(0);
        env.storage().instance().set(&DataKey::RetirementCount, &(ret_count + 1));

        env.events().publish((symbol_short!("rec"), symbol_short!("retired")), (id, owner));
        true
    }

    pub fn get_rec(env: Env, id: u64) -> Option<RecItem> {
        env.storage().persistent().get(&DataKey::Rec(id))
    }

    pub fn get_rec_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::RecCount).unwrap_or(0)
    }

    pub fn get_retirement_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::RetirementCount).unwrap_or(0)
    }
}

#[cfg(test)]
mod test;

