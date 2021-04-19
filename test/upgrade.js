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
  const invalidMarket = '0xBdf447B39D152d6A234B4c02772B8ab5D1783F72';
  const crBACAddress = '0x460ea730d204c822cE709f00A8E5959921715aDC';
  const crOMGAddress = '0x7Aaa323D7e398be4128c7042d197a2545f0f1fea';

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

    await unitroller.connect(creamMultisig)._delistMarket(invalidMarket);
    await check(unitroller, invalidMarket);

    await unitroller.connect(creamMultisig)._delistMarket(crBACAddress);
    await check(unitroller, crBACAddress);

    await expect(unitroller.connect(creamMultisig)._delistMarket(crBACAddress)).to.be.revertedWith('market not listed');
    await expect(unitroller.connect(creamMultisig)._delistMarket(crOMGAddress)).to.be.revertedWith('market not empty');

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });
  });
});

async function check(unitroller, token) {
  const allMarkets = await unitroller.getAllMarkets();
  expect(allMarkets.includes(token)).to.equal(false);

  const [isListed, collateralFactor, isComped] = await unitroller.markets(token);
  expect(isListed).to.equal(false);
  expect(collateralFactor.toString()).to.equal('0');
  expect(isComped).to.equal(false);
}
