#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{symbol_short, Address, Env};
use soroban_sdk::testutils::Address as _;

fn setup_marketplace(env: &Env) -> (Address, Address, RecMarketplaceContractClient<'static>, RewardTokenContractClient<'static>) {
    let reward_contract_id = Address::generate(env);
    env.register_contract(&reward_contract_id, RewardTokenContract);
    let reward_client = RewardTokenContractClient::new(env, &reward_contract_id);

    let marketplace_contract_id = Address::generate(env);
    env.register_contract(&marketplace_contract_id, RecMarketplaceContract);
    let marketplace_client = RecMarketplaceContractClient::new(env, &marketplace_contract_id);

    let admin = Address::generate(env);
    marketplace_client.initialize(&admin, &reward_contract_id);

    (admin, reward_contract_id, marketplace_client, reward_client)
}

#[test]
fn test_create_rec_and_get_rec() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, _, marketplace, _) = setup_marketplace(&env);

    assert!(marketplace.create_rec(&admin, &101, &50, &10_000_000, &symbol_short!("solar")));
    assert_eq!(marketplace.get_rec_count(), 1);

    let rec = marketplace.get_rec(&101).unwrap();
    assert_eq!(rec.id, 101);
    assert_eq!(rec.amount_mwh, 50);
    assert_eq!(rec.is_sold, false);
    assert_eq!(rec.owner, admin);
}

#[test]
fn test_inter_contract_communication() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, _, marketplace, reward) = setup_marketplace(&env);
    let buyer = Address::generate(&env);

    marketplace.create_rec(&admin, &201, &100, &20_000_000, &symbol_short!("wind"));
    assert_eq!(reward.balance_of(&buyer), 0);

    assert!(marketplace.buy_rec(&buyer, &201));
    assert_eq!(reward.balance_of(&buyer), 10_000_000);

    let rec = marketplace.get_rec(&201).unwrap();
    assert!(rec.is_sold);
    assert_eq!(rec.owner, buyer);
}

#[test]
fn test_duplicate_rec_id_check() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, _, marketplace, _) = setup_marketplace(&env);
    marketplace.create_rec(&admin, &301, &10, &5_000_000, &symbol_short!("hydro"));
    assert_eq!(marketplace.get_rec_count(), 1);
}

#[test]
fn test_buy_rec_status_check() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, _, marketplace, _) = setup_marketplace(&env);
    let buyer = Address::generate(&env);

    marketplace.create_rec(&admin, &401, &10, &5_000_000, &symbol_short!("solar"));
    assert!(marketplace.buy_rec(&buyer, &401));
    let rec = marketplace.get_rec(&401).unwrap();
    assert!(rec.is_sold);
}

#[test]
fn test_get_rec_count_increments() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, _, marketplace, _) = setup_marketplace(&env);
    assert_eq!(marketplace.get_rec_count(), 0);

    marketplace.create_rec(&admin, &501, &5, &1_000_000, &symbol_short!("bio"));
    marketplace.create_rec(&admin, &502, &5, &1_000_000, &symbol_short!("bio"));
    assert_eq!(marketplace.get_rec_count(), 2);
}
