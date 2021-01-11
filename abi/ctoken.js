module.exports = [
  'function mint(uint mintAmount) external returns (uint)',
  'function borrow(uint borrowAmount) external returns (uint)',
  'function repayBorrow(uint repayAmount) external returns (uint)',
  'function redeemUnderlying(uint redeemAmount) external returns (uint)',
  'function transfer(address dst, uint amount) external returns (bool)',
  'function _addReserves(uint addAmount) external returns (uint)',
  'function _reduceReserves(uint reduceAmount) external returns (uint)',
  'function totalSupply() external view returns (uint256)',
  'function sushiUserAccrued(address user) external view returns (uint256)',
  'function slpSupplierIndex(address user) external view returns (uint256)',
  'function claimSushi() external'
];
