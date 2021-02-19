const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const cTokenAbi = require('../abi/ctoken');
const erc20Abi = require('../abi/erc20');

describe('crSLP', () => {
  const toWei = ethers.utils.parseEther;
  const provider = waffle.provider;
  const MAX = ethers.constants.MaxUint256;

  let externalAccount;
  let creamMultisig;
  let sUSD;
  let cySUSD;

  // externalAddress has some sUSD.
  const externalAddress = '0x49BE88F0fcC3A8393a59d3688480d7D253C37D2A';
  const cySUSDAddress = '0x4e3a36A633f63aee0aB57b5054EC78867CB3C0b8';
  const sUSDAddress = '0x57ab1ec28d129707052df4df418d58a2d46d5f51';
  const creamMultisigAddress = '0x6D5a7597896A703Fe8c85775B23395a48f971305';

  // victims
  const victims = ['0x431e81E5dfB5A24541b5Ff8762bDEF3f32F96354', '0x23f6ce52eef00F76b7770Bd88d39F2156662f6C6'];
  let victimBalances = [];

  beforeEach(async () => {
    externalAccount = await ethers.provider.getSigner(externalAddress);
    creamMultisig = await ethers.provider.getSigner(creamMultisigAddress);

    sUSD = new ethers.Contract(sUSDAddress, erc20Abi, provider);
    for (let i = 0; i < victims.length; i++) {
      const balance = await sUSD.balanceOf(victims[i]);
      victimBalances.push(balance);
    }

    // 1. Send 15000 sUSD to cream multisig address.
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [externalAddress]
    });

    await sUSD.connect(externalAccount).transfer(creamMultisigAddress, toWei('15000'));

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [externalAddress]
    });

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    // 2. Approve cySUSD to pull sUSD from cream multisig address.
    await sUSD.connect(creamMultisig).approve(cySUSDAddress, MAX);

    // 3. Deploy new cDelegate.
    const delegateeFactory = await ethers.getContractFactory('CErc20Delegate');
    const cDelegatee = await delegateeFactory.deploy();

    // 4. Change cySUSD implementation.
    cySUSD = new ethers.Contract(cySUSDAddress, cTokenAbi, provider);

    await cySUSD.connect(creamMultisig)._setImplementation(cDelegatee.address, true, '0x00');
    expect(await cySUSD.implementation()).to.equal(cDelegatee.address);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });
  });

  it('upgrades', async () => {
    // 1. Check victim balances.
    for (let i = 0; i < victims.length; i++) {
      const sUSDBalance = await sUSD.balanceOf(victims[i]);
      const sUSDReceived = sUSDBalance.sub(victimBalances[i]);
      expect(sUSDReceived).to.gt(0);

      console.log(victims[i], sUSDReceived.toString());

      const cySUSDBalance = await cySUSD.balanceOf(victims[i]);
      expect(cySUSDBalance).to.equal(0);
    }

    // 2. Check cySUSD total supply.
    // Total supply shoud decrease to 6,096,838,581.
    const totalSupply = await cySUSD.totalSupply();
    console.log('totalSupply', totalSupply.toString());

    // 3. Check remaining sUSD in cream multisig address.
    // Got 15000 sUSD at the beginning. Should remain about 1523 sUSD.
    const reamining = await sUSD.balanceOf(creamMultisigAddress);
    console.log('reamining', reamining.toString());
  });
});
