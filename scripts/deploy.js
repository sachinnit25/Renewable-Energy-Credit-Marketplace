async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with', deployer.address);

  const Reward = await ethers.getContractFactory('Reward');
  const reward = await Reward.deploy();
  await reward.deployed();
  console.log('Reward deployed to', reward.address);

  const Marketplace = await ethers.getContractFactory('Marketplace');
  const market = await Marketplace.deploy(reward.address);
  await market.deployed();
  console.log('Marketplace deployed to', market.address);

  // transfer ownership of reward contract to marketplace so it can mint
  const tx = await reward.transferOwnership(market.address);
  await tx.wait();
  console.log('Reward ownership transferred to marketplace');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
