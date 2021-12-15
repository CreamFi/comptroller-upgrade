module.exports = [
  'function mint(uint mintAmount) external returns (uint)',
  'function redeemUnderlying(uint redeemAmount) external returns (uint)',
  'function balanceOf(address account) external view returns (uint)',
  'function _setImplementation(address implementation_, bool allowResign, bytes memory becomeImplementationData) external',
  'function implementation() external view returns (address)',
  'function borrowBalanceStored(address account) public view returns (uint256)',
];
