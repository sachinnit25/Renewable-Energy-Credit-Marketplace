const { expect } = require('chai');

describe('Marketplace integration', function () {
  let Reward, Marketplace, reward, market, owner, seller, buyer;

  beforeEach(async function () {
    [owner, seller, buyer] = await ethers.getSigners();
    Reward = await ethers.getContractFactory('Reward');
    reward = await Reward.connect(owner).deploy();
    await reward.deployed();

    Marketplace = await ethers.getContractFactory('Marketplace');
    market = await Marketplace.connect(owner).deploy(reward.address);
    await market.deployed();

    // transfer ownership so marketplace can mint
    await reward.connect(owner).transferOwnership(market.address);
  });

  it('creates listing and allows purchase with rewards minted', async function () {
    const price = ethers.utils.parseEther('0.01');
    const tx = await market.connect(seller).createListing(price, 'ipfs://metadata');
    await tx.wait();

    const id = 0;
    // buyer purchases
    await expect(() =>
      market.connect(buyer).purchase(id, { value: price })
    ).to.changeEtherBalances([buyer, seller], [price.mul(-1), price]);

    // reward balances should be minted (1 token each)
    const balSeller = await reward.balanceOf(seller.address);
    const balBuyer = await reward.balanceOf(buyer.address);
    expect(balSeller).to.equal(ethers.utils.parseEther('1'));
    expect(balBuyer).to.equal(ethers.utils.parseEther('1'));
  });
});
