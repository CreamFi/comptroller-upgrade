module.exports = [
  'function _setAllowlist(address protocol, bool allow) external',
  'function _setCreditLimit(address protocol, uint creditLimit) external',
  'function _dropInvalidMarket() external',
  'function getAllMarkets() external view returns (address[] memory)',
  'function markets(address market) external view returns (bool,uint,bool,uint)'
];
