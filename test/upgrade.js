const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const cTokenAbi = require('../abi/ctoken');
const erc20Abi = require('../abi/erc20');

describe('crSLP', () => {
  const toWei = ethers.utils.parseEther;
  const provider = waffle.provider;
  const MAX = ethers.constants.MaxUint256;

  let externalAccount;
  let crFTT;

  // externalAddress has some FTT.
  const cCapableErc20DelegateAddress = '0x852dc31074d42BEB1ee8fBa7829Cb5BD4D68aaf3';
  const externalAddress = '0x772589e99bC9C54DD40acb7d73F88Ccbc9D9CF47';
  const crFTTAddress = '0x10FDBD1e48eE2fD9336a482D746138AE19e649Db';
  const fttAddress = '0x50d1c9771902476076ecfc8b2a83ad6b9355a4c9';
  const creamMultisigAddress = '0x6D5a7597896A703Fe8c85775B23395a48f971305';

  beforeEach(async () => {
    externalAccount = await ethers.provider.getSigner(externalAddress);
    const creamMultisig = await ethers.provider.getSigner(creamMultisigAddress);

    crFTT = new ethers.Contract(crFTTAddress, cTokenAbi, provider);
    const balance1 = await crFTT.getCash();

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    await crFTT.connect(creamMultisig)._setImplementation(cCapableErc20DelegateAddress, true, '0x00');
    expect(await crFTT.implementation()).to.equal(cCapableErc20DelegateAddress);

    const balance2 = await crFTT.getCash();
    expect(balance1).to.equal(balance2);
    
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });
  });

  it('upgrades', async () => {
    const balance1 = await crFTT.balanceOf(externalAddress);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [externalAddress]
    });

    const ftt = new ethers.Contract(fttAddress, erc20Abi, provider);
    await ftt.connect(externalAccount).approve(crFTT.address, MAX);

    await crFTT.connect(externalAccount).mint(toWei('100'));
    const balance2 = await crFTT.balanceOf(externalAddress);
    const balanceDiff = balance2.sub(balance1);
    expect(balanceDiff).to.gt(0);
    console.log('balanceDiff', balanceDiff.toString())

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [externalAddress]
    });
  });
});
