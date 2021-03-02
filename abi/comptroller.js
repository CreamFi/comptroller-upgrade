module.exports = [
  'function _supportMarket(address cToken) external returns (uint)',
  'function enterMarkets(address[] memory cTokens) public returns (uint[] memory)',
  'function getAccountLiquidity(address account) public view returns (uint, uint, uint)',
  'function getHypotheticalAccountLiquidity(address account, address cTokenModify, uint redeemTokens, uint borrowAmount) public view returns (uint, uint, uint)',
  'function _setCollateralFactor(address cToken, uint newCollateralFactorMantissa) external returns (uint)',
];
