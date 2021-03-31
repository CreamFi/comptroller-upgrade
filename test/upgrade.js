const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const cTokenAbi = require('../abi/ctoken');
const erc20Abi = require('../abi/erc20');
const comptrollerAbi = require('../abi/comptroller');

describe('crToken', () => {
  const toWei = ethers.utils.parseEther;
  const provider = waffle.provider;
  const MAX = ethers.constants.MaxUint256;

  let externalAccount;
  let underlyingToken;
  let comptroller;

  // externalAddress has some underlying.
  const externalAddress = '0x5b33D097820A0197cdF939E050cF57ECbA11279A';
  const crTokenAddress = '0x1bcaFA2C1b3a522E41bAa60C2E318981Ea8D1eb5';
  const underlyingAddress = '0xdCD90C7f6324cfa40d7169ef80b12031770B4325';
  const comptrollerAddress = '0x3d5BC3c8d13dcB8bF317092d84783c2697AE9258';
  const creamMultisigAddress = '0x6D5a7597896A703Fe8c85775B23395a48f971305';

  beforeEach(async () => {
    const faucet = (await ethers.getSigners())[0];
    externalAccount = await ethers.provider.getSigner(externalAddress);
    underlyingToken = new ethers.Contract(underlyingAddress, erc20Abi, provider);

    // Give the external address some gas fees
    await faucet.sendTransaction({
      to: externalAddress,
      value: toWei('1')
    });
  });

  it('mint', async() => {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [externalAddress]
    });

    await underlyingToken.connect(externalAccount).approve(crTokenAddress, MAX);
    console.log('approved');

    console.log('underlying:', ethers.utils.formatEther(await underlyingToken.balanceOf(externalAddress)));
    let crToken = new ethers.Contract(crTokenAddress, cTokenAbi, provider);
    await crToken.connect(externalAccount).mint(toWei('10'));
    console.log('minted');

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });
  });
});
