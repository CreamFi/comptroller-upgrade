const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const cTokenAbi = require('../abi/ctoken');
const erc20Abi = require('../abi/erc20');
const wethAbi = require('../abi/weth');

describe('crSLP', () => {
  const toWei = ethers.utils.parseEther;
  const provider = waffle.provider;
  const MAX = ethers.constants.MaxUint256;

  let accounts;
  let user1, user1Address;

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

  // attacker
  const attackerAddress = '0x560A8E3B79d23b0A525E15C6F3486c6A293DDAd2';

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    user1 = accounts[0];
    user1Address = await user1.getAddress();

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
    const remaining = await sUSD.balanceOf(creamMultisigAddress);
    console.log('remaining', remaining.toString());


    // 4. Try liquidate the attacker.
    const cyWETHAddress = '0x41c84c0e2EE0b740Cf0d31F63f3B6F627DC6b393';
    const cyWETH = new ethers.Contract(cyWETHAddress, cTokenAbi, provider);

    const wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const weth = new ethers.Contract(wethAddress, wethAbi, provider);

    // Change 20 ETH to WETH.
    await weth.connect(user1).deposit({value: toWei('20')});

    // Send 10 WETH to cream multisig address.
    await weth.connect(user1).transfer(creamMultisigAddress, toWei('10'));

    // Approve cyWETH to use user's WETH.
    await weth.connect(user1).approve(cyWETH.address, MAX);

    // User couldn't liquidate.
    await expect(
      cyWETH.connect(user1).liquidateBorrow(attackerAddress, toWei('10'), cySUSDAddress)
    ).to.be.revertedWith('only cream multisig address could seize cySUSD');

    // Now it's cream multisig's turn.
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    const cySUSDBalance1 = await cySUSD.balanceOf(creamMultisigAddress);

    // Approve cyWETH to use cream multisig's WETH.
    await weth.connect(creamMultisig).approve(cyWETH.address, MAX);

    // Liquidate!
    await cyWETH.connect(creamMultisig).liquidateBorrow(attackerAddress, toWei('10'), cySUSDAddress);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });

    const cySUSDBalance2 = await cySUSD.balanceOf(creamMultisigAddress);
    const cySUSDBalanceDiff = cySUSDBalance2.sub(cySUSDBalance1);
    expect(cySUSDBalanceDiff).to.gt(0);

    // Liquidate the attacker with 10 WETH.
    // Should get (ETH price * 10 * 1.08 / exchangeRate) cySUSD. (e.g 2,052,710 cySUSD for ETH price at 1,900)
    console.log('cySUSDBalanceDiff', cySUSDBalanceDiff.toString());
  });
});
