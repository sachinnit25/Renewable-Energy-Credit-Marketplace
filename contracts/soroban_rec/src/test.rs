#![cfg(test)]

use super::*;
use soroban_sdk::{symbol_short, Env};

#[test]
fn test_create_and_buy_rec() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, RecMarketplaceContract);
    let client = RecMarketplaceContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let buyer = Address::generate(&env);

    client.initialize(&admin);

    let success = client.create_rec(&admin, &101, &50, &10000000, &symbol_short!("solar"));
    assert!(success);

    assert_eq!(client.get_rec_count(), 1);

    let item = client.get_rec(&101).unwrap();
    assert_eq!(item.id, 101);
    assert_eq!(item.is_sold, false);

    let bought = client.buy_rec(&buyer, &101);
    assert!(bought);

    let updated_item = client.get_rec(&101).unwrap();
    assert_eq!(updated_item.is_sold, true);
    assert_eq!(updated_item.owner, buyer);
}
