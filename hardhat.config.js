/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomiclabs/hardhat-waffle");
require('hardhat-contract-sizer');

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
        url: "https://bsc-dataseed1.binance.org/"
      }
    }
  },
  mocha: {
    timeout: 600000
  }
};
