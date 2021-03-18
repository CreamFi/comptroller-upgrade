const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const cTokenAbi = require('../abi/ctoken');
const unitrollerAbi = require('../abi/unitroller');
const comptrollerAbi = require("../abi/comptroller");

describe('upgrade', () => {
  const provider = waffle.provider;

  let accounts;
  let admin, adminAddress;
  let creamMultisig;

  let unitroller;
  let newComptroller;
  let newCTokenImplementation;

  const creamMultisigAddress = '0x6D5a7597896A703Fe8c85775B23395a48f971305';
  const unitrollerAddress = '0x3d5BC3c8d13dcB8bF317092d84783c2697AE9258';

  const crUSDTAddress = '0x797AAB1ce7c01eB727ab980762bA88e7133d2157';
  const crBUSDAddress = '0x1FF8CDB51219a8838b52E9cAc09b71e591BC998e';
  const crALPHAAddress = '0x1d0986Fb43985c88Ffa9aD959CC24e6a087C7e35';

  before(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    adminAddress = await admin.getAddress();

    const implementationFactory = await ethers.getContractFactory('CCollateralCapErc20Delegate');
    newCTokenImplementation = await implementationFactory.deploy();

    const comptrollerFactory = await ethers.getContractFactory('Comptroller');
    newComptroller = await comptrollerFactory.deploy();

    unitroller = new ethers.Contract(unitrollerAddress, unitrollerAbi, provider);

    creamMultisig = await ethers.provider.getSigner(creamMultisigAddress);
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

  it('upgrades USDT from cErc20 to cCollateralCapErc20', async () => {
    // Random address has crToken balance.
    const externalAddress = '0xa30cc9e7ee546a037e4f4696d954658407224a4d';

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    const crUSDT = new ethers.Contract(crUSDTAddress, cTokenAbi, provider);
    await checkStorage(crUSDT, newCTokenImplementation, creamMultisig, externalAddress, false);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });
  });

  it('upgrades BUSD from cErc20 to cCollateralCapErc20', async () => {
    // Random address has crToken balance.
    const externalAddress = '0x3D5Aeff2EF3e0CEA80f43340215d6BdFC8b336a7';

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    const crBUSD = new ethers.Contract(crBUSDAddress, cTokenAbi, provider);
    await checkStorage(crBUSD, newCTokenImplementation, creamMultisig, externalAddress, false);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });
  });

  it('upgrades ALPHA from cCapableErc20 to cCollateralCapErc20', async () => {
    // Random address has crALPHA balance.
    const externalAddress = '0x537037c5ae805b9d4cecab5ee07f12a8e59a15b2';

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    const crALPHA = new ethers.Contract(crALPHAAddress, cTokenAbi, provider);
    await checkStorage(crALPHA, newCTokenImplementation, creamMultisig, externalAddress, true);

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

  await crToken.connect(creamMultisig)._setImplementation(newImplementation.address, true, '0x00');
  expect(await crToken.implementation()).to.equal(newImplementation.address);

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
