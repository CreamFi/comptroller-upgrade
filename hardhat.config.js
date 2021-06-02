/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomiclabs/hardhat-waffle");

module.exports = {
  defaultNetwork: "hardhat",
  solidity: {
    version: "0.5.17" ,
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      forking: {
        url: "https://eth-mainnet.alchemyapi.io/v2/PJx27Ybu_VQ2e9BSxWFN8qUXFTgbTotO",
        blockNumber: 12553415
      }
    }
  },
  mocha: {
    timeout: 600000
  }
};
