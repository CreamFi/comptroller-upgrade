module.exports = [
  'function mint(uint mintAmount) external returns (uint)',
  'function mintNative() external payable returns (uint)',
  'function redeemUnderlying(uint redeemAmount) external returns (uint)',
  'function balanceOf(address account) external view returns (uint)',
  'function _setImplementation(address implementation_, bool allowResign, bytes memory becomeImplementationData) external',
  'function getCash() external view returns (uint)',
];
