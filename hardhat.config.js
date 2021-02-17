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
        url: "https://mainnet-eth.compound.finance/"
      }
    }
  },
  mocha: {
    timeout: 600000
  }
};
