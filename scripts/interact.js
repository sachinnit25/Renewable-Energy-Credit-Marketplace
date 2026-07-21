require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
  const RPC = process.env.RPC_URL || 'http://127.0.0.1:8545';
  const PK = process.env.PRIVATE_KEY;
  const MARKET = process.env.MARKETPLACE_ADDRESS;

  if (!PK) {
    console.error('Set PRIVATE_KEY in .env to run this script');
    process.exit(1);
  }
  if (!MARKET) {
    console.error('Set MARKETPLACE_ADDRESS in .env to run this script');
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);

  const abi = [
    'function createListing(uint256,string) returns (uint256)',
    'function purchase(uint256) payable',
    'event ListingCreated(uint256 indexed id, address indexed seller, uint256 price, string metadata)',
    'event Purchased(uint256 indexed id, address indexed buyer, uint256 price)'
  ];

  const market = new ethers.Contract(MARKET, abi, wallet);

  // create a listing
  const price = ethers.utils.parseEther('0.01');
  console.log('Creating listing with price', price.toString());
  const txCreate = await market.createListing(price, 'demo-metadata');
  const rcCreate = await txCreate.wait();
  console.log('createListing tx hash:', txCreate.hash);

  // extract listing id from event if present
  let listingId = 0;
  const ev = rcCreate.events?.find((e) => e.event === 'ListingCreated');
  if (ev && ev.args) listingId = ev.args.id.toString();
  console.log('Listing id:', listingId);

  // purchase the listing
  console.log('Purchasing listing', listingId);
  const txBuy = await market.purchase(listingId, { value: price });
  const rcBuy = await txBuy.wait();
  console.log('purchase tx hash:', txBuy.hash);

  console.log('\nDone. Save these tx hashes for submission.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
