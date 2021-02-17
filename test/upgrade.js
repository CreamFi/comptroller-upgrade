const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const unitrollerAbi = require('../abi/unitroller');
const comptrollerAbi = require("../abi/comptroller");

describe('upgrade', () => {
  const provider = waffle.provider;

  let accounts;
  let admin, adminAddress;

  let unitroller;
  let newComptroller;

  const creamMultisigAddress = '0x6D5a7597896A703Fe8c85775B23395a48f971305';
  const unitrollerAddress = '0x3d5BC3c8d13dcB8bF317092d84783c2697AE9258';

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    adminAddress = await admin.getAddress();

    const comptrollerFactory = await ethers.getContractFactory('Comptroller');
    newComptroller = await comptrollerFactory.deploy();

    unitroller = new ethers.Contract(unitrollerAddress, unitrollerAbi, provider);
  });

  it('remove invalid market', async () => {
    const creamMultisig = await ethers.provider.getSigner(creamMultisigAddress);

    // 1. Change comptroller.
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    await unitroller.connect(creamMultisig)._setPendingImplementation(newComptroller.address);
    await newComptroller.connect(creamMultisig)._become(unitroller.address);

    expect(await unitroller.comptrollerImplementation()).to.equal(newComptroller.address);

    unitroller = new ethers.Contract(unitrollerAddress, comptrollerAbi, provider);

    const oldAllMarkets = await unitroller.getAllMarkets();

    await unitroller.connect(creamMultisig)._dropInvalidMarket();

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });

    const newAllMarkets = await unitroller.getAllMarkets();
    expect(oldAllMarkets.length).to.equal(newAllMarkets.length + 1);
  });
});
