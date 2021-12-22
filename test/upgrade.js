const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const ctokenAbi = require('../abi/ctoken');
const ctokenAdminAbi = require('../abi/ctokenAdmin');

function encodeParameters(types, values) {
  const abi = new ethers.utils.AbiCoder();
  return abi.encode(types, values);
}

describe('upgrade', () => {
  const provider = waffle.provider;

  let accounts;
  let admin, adminAddress;

  let cTokenAdmin;

  let cyWeth;
  let cyDai;
  let cyUsdc;
  let cyUsdt;

  let renameDelegate;

  const cTokenAdminAddress = '0xA67B44E37200e92e6Da6249d8ae6D48f832A038d';

  const creamMultisigAddress = '0x6D5a7597896A703Fe8c85775B23395a48f971305';
  const cyWethAddress = '0x41c84c0e2EE0b740Cf0d31F63f3B6F627DC6b393';
  const cyDaiAddress = '0x8e595470Ed749b85C6F7669de83EAe304C2ec68F';
  const cyUsdtAddress = '0x48759F220ED983dB51fA7A8C0D2AAb8f3ce4166a';
  const cyUsdcAddress = '0x76Eb2FE28b36B3ee97F3Adae0C69606eeDB2A37c';

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    adminAddress = await admin.getAddress();

    cTokenAdmin = new ethers.Contract(cTokenAdminAddress, ctokenAdminAbi, provider);

    cyWeth = new ethers.Contract(cyWethAddress, ctokenAbi, provider);
    cyDai = new ethers.Contract(cyDaiAddress, ctokenAbi, provider);
    cyUsdc = new ethers.Contract(cyUsdcAddress, ctokenAbi, provider);
    cyUsdt = new ethers.Contract(cyUsdtAddress, ctokenAbi, provider);

    const delegateeFactory = await ethers.getContractFactory('CRenameDelegate');
    renameDelegate = await delegateeFactory.deploy();
  });

  it('upgrades cyWeth', async () => {
    await check(cyWeth, cyWethAddress, 'Iron Bank Weth', 'ibWeth');
  });

  it('upgrades cyDai', async () => {
    await check(cyDai, cyDaiAddress, 'Iron Bank Dai', 'ibDai');
  });

  it('upgrades cyUsdc', async () => {
    await check(cyUsdc, cyUsdcAddress, 'Iron Bank Usdc', 'ibUsdc');
  });

  it('upgrades cyUsdt', async () => {
    await check(cyUsdt, cyUsdtAddress, 'Iron Bank Usdt', 'ibUsdt');
  });

  async function check(cToken, cTokenAddress, name, symbol) {
    const creamMultisig = ethers.provider.getSigner(creamMultisigAddress);

    const oldImplementationAddress = await cToken.implementation();

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    await cTokenAdmin.connect(creamMultisig)._setImplementation(cTokenAddress, renameDelegate.address, true, encodeParameters(['string', 'string'], [name, symbol]));
    expect(await cToken.implementation()).to.equal(renameDelegate.address);

    await cTokenAdmin.connect(creamMultisig)._setImplementation(cTokenAddress, oldImplementationAddress, true, '0x00');
    expect(await cToken.implementation()).to.equal(oldImplementationAddress);
    expect(await cToken.name()).to.equal(name);
    expect(await cToken.symbol()).to.equal(symbol);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });
  }
});
