require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

module.exports = {
  solidity: {
    compilers: [
      { version: '0.8.19' }
    ]
  },
  networks: {
    localhost: {},
    sepolia: {
      url: process.env.SEPOLIA_RPC || '',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  }
};
