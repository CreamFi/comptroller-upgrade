const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const unitrollerAbi = require('../abi/unitroller');
const erc20Abi = require('../abi/erc20');
const cTokenAbi = require('../abi/ctoken');
const comptrollerAbi = require("../abi/comptroller");

describe('upgrade', () => {
  const toWei = ethers.utils.parseEther;
  const provider = waffle.provider;

  let accounts;
  let admin, adminAddress;

  let unitroller;
  let newComptroller;
  let weth;
  let cyWeth;

  const creamMultisigAddress = '0x6D5a7597896A703Fe8c85775B23395a48f971305';
  const unitrollerAddress = '0xAB1c342C7bf5Ec5F02ADEA1c2270670bCa144CbB';
  const externalAddress = '0x11690B00Fef3091f37Dd0F88e36c838Cd344547f';
  const wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  const cyWethAddress = '0x41c84c0e2EE0b740Cf0d31F63f3B6F627DC6b393';

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    adminAddress = await admin.getAddress();

    const comptrollerFactory = await ethers.getContractFactory('Comptroller');
    newComptroller = await comptrollerFactory.deploy();

    unitroller = new ethers.Contract(unitrollerAddress, unitrollerAbi, provider);
    weth = new ethers.Contract(wethAddress, erc20Abi, provider);
    cyWeth = new ethers.Contract(cyWethAddress, cTokenAbi, provider);
  });

  it('credit limit is never used', async () => {
    const externalAccount = await ethers.provider.getSigner(externalAddress);
    const creamMultisig = await ethers.provider.getSigner(creamMultisigAddress);

    // 1. Change comptroller.
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    await unitroller.connect(creamMultisig)._setPendingImplementation(newComptroller.address);
    await newComptroller.connect(creamMultisig)._become(unitroller.address);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });

    expect(await unitroller.comptrollerImplementation()).to.equal(newComptroller.address);

    // 2. Mint weth.
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [externalAddress]
    });

    await weth.connect(externalAccount).approve(cyWethAddress, toWei('0.1'));
    await cyWeth.connect(externalAccount).mint(toWei('0.1'));

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [externalAddress]
    });

    unitroller = new ethers.Contract(unitrollerAddress, comptrollerAbi, provider);

    // 3. Set allowlist.
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    await unitroller.connect(creamMultisig)._setAllowlist(creamMultisigAddress, true);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });

    // 4. Redeem weth.
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [externalAddress]
    });

    await cyWeth.connect(externalAccount).redeemUnderlying(toWei('0.1'));

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [externalAddress]
    });
  });

  it('credit limit has been used', async () => {
    const externalAccount = await ethers.provider.getSigner(externalAddress);
    const creamMultisig = await ethers.provider.getSigner(creamMultisigAddress);

    // 1. Set credit limit
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    unitroller = new ethers.Contract(unitrollerAddress, comptrollerAbi, provider);
    await unitroller.connect(creamMultisig)._setCreditLimit(creamMultisigAddress, toWei('1'));

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });

    // 2. Change comptroller.
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    unitroller = new ethers.Contract(unitrollerAddress, unitrollerAbi, provider);
    await unitroller.connect(creamMultisig)._setPendingImplementation(newComptroller.address);
    await newComptroller.connect(creamMultisig)._become(unitroller.address);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });

    expect(await unitroller.comptrollerImplementation()).to.equal(newComptroller.address);

    // 3. Mint weth.
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [externalAddress]
    });

    await weth.connect(externalAccount).approve(cyWethAddress, toWei('0.1'));
    await cyWeth.connect(externalAccount).mint(toWei('0.1'));

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [externalAddress]
    });

    unitroller = new ethers.Contract(unitrollerAddress, comptrollerAbi, provider);

    // 4. Set allowlist.
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    await unitroller.connect(creamMultisig)._setAllowlist(creamMultisigAddress, true);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });

    // 5. Redeem weth.
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [externalAddress]
    });

    await cyWeth.connect(externalAccount).redeemUnderlying(toWei('0.1'));

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [externalAddress]
    });
  });
});
