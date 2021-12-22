module.exports = [
  'function mint(uint mintAmount) external returns (uint)',
  'function redeemUnderlying(uint redeemAmount) external returns (uint)',
  'function balanceOf(address account) external view returns (uint)',
  'function _setImplementation(address implementation_, bool allowResign, bytes memory becomeImplementationData) external',
  'function implementation() external view returns (address)',
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
];
