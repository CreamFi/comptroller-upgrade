const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const cTokenAbi = require('../abi/ctoken');
const erc20Abi = require('../abi/erc20');
const comptrollerAbi = require("../abi/comptroller");

describe('upgrade', () => {
  const toWei = ethers.utils.parseEther;
  const provider = waffle.provider;

  let accounts;
  let admin, adminAddress;
  let creamMultisig;

  let comptroller;

  let crFTT;
  let ftt;

  const creamMultisigAddress = '0x6D5a7597896A703Fe8c85775B23395a48f971305';
  const unitrollerAddress = '0x3d5BC3c8d13dcB8bF317092d84783c2697AE9258';

  const crFTTAddress = '0x10FDBD1e48eE2fD9336a482D746138AE19e649Db';
  const fttAddress = '0x50D1c9771902476076eCFc8B2A83Ad6b9355a4c9';

  before(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    adminAddress = await admin.getAddress();

    comptroller = new ethers.Contract(unitrollerAddress, comptrollerAbi, provider);

    creamMultisig = await ethers.provider.getSigner(creamMultisigAddress);

    crFTT = new ethers.Contract(crFTTAddress, cTokenAbi, provider);
    ftt = new ethers.Contract(fttAddress, erc20Abi, provider);
  });

  it('tests', async () => {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    const cap = '500000000000'; // 100 * 50 * 1e8
    await crFTT.connect(creamMultisig)._setCollateralCap(cap);
    expect(await crFTT.collateralCap()).to.equal(cap);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });

    // External address has FTT.
    const externalAddress2 = '0x772589e99bC9C54DD40acb7d73F88Ccbc9D9CF47';
    const externalAccount2 = ethers.provider.getSigner(externalAddress2);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [externalAddress2]
    });

    // 200 FTT will
    await ftt.connect(externalAccount2).approve(crFTTAddress, toWei('200'));
    await crFTT.connect(externalAccount2).mint(toWei('200'));
    await comptroller.connect(externalAccount2).enterMarkets([crFTTAddress]);

    // External address 2 has used all collateral cap.
    expect(await comptroller.checkMembership(externalAddress2, crFTTAddress)).to.equal(true);
    expect(await crFTT.accountCollateralTokens(externalAddress2)).to.equal(cap);
    expect(await crFTT.totalCollateralTokens()).to.equal(cap);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [externalAddress2]
    });

    // External address has FTT and crFTT (SBF!).
    const externalAddress = '0x477573f212A7bdD5F7C12889bd1ad0aA44fb82aa';
    const externalAccount = ethers.provider.getSigner(externalAddress);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [externalAddress]
    });

    await ftt.connect(externalAccount).approve(crFTTAddress, toWei('1'));
    await crFTT.connect(externalAccount).mint(toWei('1'));

    // External address 1 should keep his original collateral.
    expect(await crFTT.accountCollateralTokens(externalAddress)).to.equal('1244245152468254');
    expect(await crFTT.totalCollateralTokens()).to.equal('1244745152468254'); // 1244245152468254 + 500000000000

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [externalAddress]
    });
  });
});
