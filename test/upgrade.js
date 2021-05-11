const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const cTokenAbi = require('../abi/ctoken');
const erc20Abi = require('../abi/erc20');
const unitrollerAbi = require('../abi/unitroller');
const comptrollerAbi = require("../abi/comptroller");

describe('upgrade', () => {
  const provider = waffle.provider;

  let accounts;
  let admin, adminAddress;
  let creamMultisig;

  let unitroller;
  let newComptroller;

  let crFTT;
  let ftt;

  const creamMultisigAddress = '0x6D5a7597896A703Fe8c85775B23395a48f971305';
  const unitrollerAddress = '0x3d5BC3c8d13dcB8bF317092d84783c2697AE9258';

  const comptrollerImplementation = '0x4B147984b0314260fDa782A7F508749DF4E5a083';
  const cCollateralCapErc20Delegate = '0x8dc840CEAd11A46f59c65B1697698a2B60Fa0789';

  const crFTTAddress = '0x10FDBD1e48eE2fD9336a482D746138AE19e649Db';
  const fttAddress = '0x50D1c9771902476076eCFc8B2A83Ad6b9355a4c9';

  before(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    adminAddress = await admin.getAddress();

    newComptroller = new ethers.Contract(comptrollerImplementation, comptrollerAbi, provider);

    unitroller = new ethers.Contract(unitrollerAddress, unitrollerAbi, provider);

    creamMultisig = await ethers.provider.getSigner(creamMultisigAddress);

    crFTT = new ethers.Contract(crFTTAddress, cTokenAbi, provider);
    ftt = new ethers.Contract(fttAddress, erc20Abi, provider);
  });

  it('upgrades comptroller', async () => {
    // 1. Change comptroller.
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    await unitroller.connect(creamMultisig)._setPendingImplementation(newComptroller.address);
    await newComptroller.connect(creamMultisig)._become(unitroller.address);

    expect(await unitroller.comptrollerImplementation()).to.equal(newComptroller.address);

    unitroller = new ethers.Contract(unitrollerAddress, comptrollerAbi, provider);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });


    // const allMarkets = await unitroller.getAllMarkets();
    // for (let i = 0; i < allMarkets.length; i++) {
    //   const market = await unitroller.markets(allMarkets[i]);
    //   // All market's version should be 0.
    //   expect(market[3]).to.equal(0);
    // }
  });

  it('upgrades FTT from cErc20 to cCollateralCapErc20', async () => {
    // External address has FTT.
    const externalAddress = '0x772589e99bc9c54dd40acb7d73f88ccbc9d9cf47';
    // External address has crFTT (SBF!).
    const externalAddress2 = '0x477573f212A7bdD5F7C12889bd1ad0aA44fb82aa';

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    await checkStorage(crFTT, cCollateralCapErc20Delegate, creamMultisig, externalAddress2, true);

    // TODO: check other stuffs here.

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });
  });
});

async function checkStorage(crToken, newImplementation, creamMultisig, externalAddress, wasCapable) {
  const [
    oldName,
    oldSymbol,
    oldDecimals,
    oldAdmin,
    oldPendingAdmin,
    oldComptroller,
    oldInterestRateModel,
    oldSnapshot,
    oldBorrowRate,
    oldSupplyRate,
    oldExRate,
    oldReserveFactorMantissa,
    oldAccrualBlockNumber,
    oldBorrowIndex,
    oldTotalBorrows,
    oldTotalReserves,
    oldTotalSupply,
    oldUnderlying
  ] = await Promise.all([
    crToken.name(),
    crToken.symbol(),
    crToken.decimals(),
    crToken.admin(),
    crToken.pendingAdmin(),
    crToken.comptroller(),
    crToken.interestRateModel(),
    crToken.getAccountSnapshot(externalAddress),
    crToken.borrowRatePerBlock(),
    crToken.supplyRatePerBlock(),
    crToken.exchangeRateStored(),
    crToken.reserveFactorMantissa(),
    crToken.accrualBlockNumber(),
    crToken.borrowIndex(),
    crToken.totalBorrows(),
    crToken.totalReserves(),
    crToken.totalSupply(),
    crToken.underlying()
  ]);

  let oldInternalCash;
  if (wasCapable) {
    oldInternalCash = await crToken.internalCash();
  }

  await crToken.connect(creamMultisig)._setImplementation(newImplementation, true, '0x00');
  expect(await crToken.implementation()).to.equal(newImplementation);

  const [
    newName,
    newSymbol,
    newDecimals,
    newAdmin,
    newPendingAdmin,
    newComptroller,
    newInterestRateModel,
    newSnapshot,
    newBorrowRate,
    newSupplyRate,
    newExRate,
    newReserveFactorMantissa,
    newAccrualBlockNumber,
    newBorrowIndex,
    newTotalBorrows,
    newTotalReserves,
    newTotalSupply,
    newUnderlying
  ] = await Promise.all([
    crToken.name(),
    crToken.symbol(),
    crToken.decimals(),
    crToken.admin(),
    crToken.pendingAdmin(),
    crToken.comptroller(),
    crToken.interestRateModel(),
    crToken.getAccountSnapshot(externalAddress),
    crToken.borrowRatePerBlock(),
    crToken.supplyRatePerBlock(),
    crToken.exchangeRateStored(),
    crToken.reserveFactorMantissa(),
    crToken.accrualBlockNumber(),
    crToken.borrowIndex(),
    crToken.totalBorrows(),
    crToken.totalReserves(),
    crToken.totalSupply(),
    crToken.underlying()
  ]);

  let newInternalCash;
  if (wasCapable) {
    newInternalCash = await crToken.internalCash();
  }

  expect(oldName).to.equal(newName);
  expect(oldSymbol).to.equal(newSymbol);
  expect(oldDecimals).to.equal(newDecimals);
  expect(oldAdmin).to.equal(newAdmin);
  expect(oldPendingAdmin).to.equal(newPendingAdmin);
  expect(oldComptroller).to.equal(newComptroller);
  expect(oldInterestRateModel).to.equal(newInterestRateModel);
  for (let i = 0; i < 4; i++) {
    expect(oldSnapshot[i]).to.equal(newSnapshot[i]);
  }
  expect(oldBorrowRate).to.equal(newBorrowRate);
  expect(oldSupplyRate).to.equal(newSupplyRate);
  expect(oldExRate).to.equal(newExRate);
  expect(oldReserveFactorMantissa).to.equal(newReserveFactorMantissa);
  expect(oldAccrualBlockNumber).to.equal(newAccrualBlockNumber);
  expect(oldBorrowIndex).to.equal(newBorrowIndex);
  expect(oldTotalBorrows).to.equal(newTotalBorrows);
  expect(oldTotalReserves).to.equal(newTotalReserves);
  expect(oldTotalSupply).to.equal(newTotalSupply);
  expect(oldUnderlying).to.equal(newUnderlying);
  if (wasCapable) {
    expect(oldInternalCash).to.equal(newInternalCash);
  }
}
