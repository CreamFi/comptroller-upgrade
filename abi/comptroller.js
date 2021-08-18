module.exports = [
  'function _setAllowlist(address protocol, bool allow) external',
  'function _setCreditLimit(address protocol, uint creditLimit) external',
  'function _dropInvalidMarket() external',
  'function _setFlashloanPaused(address cToken, bool state) external returns (bool)',
  'function flashloanGuardianPaused(address addr) external view returns (bool)',
  'function getAllMarkets() external view returns (address[] memory)'
];
