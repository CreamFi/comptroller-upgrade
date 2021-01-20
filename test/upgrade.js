const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const cTokenAbi = require('../abi/ctoken');

describe('crSLP', () => {
  const provider = waffle.provider;

  let externalAccount;
  let crUSDT;

  // externalAddress has some USDT.
  const externalAddress = '0x11690B00Fef3091f37Dd0F88e36c838Cd344547f';
  const crUSDTAddress = '0x797AAB1ce7c01eB727ab980762bA88e7133d2157';
  const creamMultisigAddress = '0x6D5a7597896A703Fe8c85775B23395a48f971305';

  beforeEach(async () => {
    externalAccount = await ethers.provider.getSigner(externalAddress);
    const creamMultisig = await ethers.provider.getSigner(creamMultisigAddress);

    // 1. Deploy new cDelegate.
    const delegateeFactory = await ethers.getContractFactory('CErc20Delegate');
    const cDelegatee = await delegateeFactory.deploy();

    // 2. Change crUSDT implementation.
    crUSDT = new ethers.Contract(crUSDTAddress, cTokenAbi, provider);
    const balance1 = await crUSDT.getCash();

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    await crUSDT.connect(creamMultisig)._setImplementation(cDelegatee.address, true, '0x00');
    expect(await crUSDT.implementation()).to.equal(cDelegatee.address);

    const balance2 = await crUSDT.getCash();
    expect(balance1).to.equal(balance2);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });
  });

  it('upgrades', async () => {
    const balance1 = await crUSDT.balanceOf(externalAddress);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [externalAddress]
    });

    await crUSDT.connect(externalAccount).mint(1000000);
    const balance2 = await crUSDT.balanceOf(externalAddress);
    const balanceDiff = balance2.sub(balance1);
    expect(balanceDiff).to.gt(0);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [externalAddress]
    });
  });
});
