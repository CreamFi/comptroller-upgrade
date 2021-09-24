const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const ctokenAbi = require('../abi/ctoken');
const ctokenAdminAbi = require('../abi/ctokenAdmin');
const erc20Abi = require('../abi/erc20');

describe('upgrade', () => {
  const toWei = ethers.utils.parseEther;
  const provider = waffle.provider;
  const MAX = ethers.constants.MaxUint256;

  let accounts;
  let admin, adminAddress;

  let cTokenAdmin;

  let cyWeth;
  let cyDai;
  let cyUsdc;
  let cyUsdt;

  let weth;
  let dai;
  let usdc;
  let usdt;

  let wethHolder;
  let daiHolder;
  let usdcHolder;
  let usdtHolder;

  const cTokenAdminAddress = '0xA67B44E37200e92e6Da6249d8ae6D48f832A038d';

  const creamMultisigAddress = '0x6D5a7597896A703Fe8c85775B23395a48f971305';
  const cyWethAddress = '0x41c84c0e2EE0b740Cf0d31F63f3B6F627DC6b393';
  const cyDaiAddress = '0x8e595470Ed749b85C6F7669de83EAe304C2ec68F';
  const cyUsdtAddress = '0x48759F220ED983dB51fA7A8C0D2AAb8f3ce4166a';
  const cyUsdcAddress = '0x76Eb2FE28b36B3ee97F3Adae0C69606eeDB2A37c';

  const newImplementationAddress = '0xCA1041f188FfEcC499e8D4D0F08Dd31B0F41c157';

  const wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
  const usdtAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

  const wethHolderAddress = '0xe5F8086DAc91E039b1400febF0aB33ba3487F29A';
  const daiHolderAddress = '0xe5F8086DAc91E039b1400febF0aB33ba3487F29A';
  const usdcHolderAddress = '0xbC8d28CD1821be81bc3A54E935CfD3cf686a0194';
  const usdtHolderAddress = '0x67aB29354a70732CDC97f372Be81d657ce8822cd';

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    adminAddress = await admin.getAddress();

    cTokenAdmin = new ethers.Contract(cTokenAdminAddress, ctokenAdminAbi, provider);

    cyWeth = new ethers.Contract(cyWethAddress, ctokenAbi, provider);
    cyDai = new ethers.Contract(cyDaiAddress, ctokenAbi, provider);
    cyUsdc = new ethers.Contract(cyUsdcAddress, ctokenAbi, provider);
    cyUsdt = new ethers.Contract(cyUsdtAddress, ctokenAbi, provider);

    weth = new ethers.Contract(wethAddress, erc20Abi, provider);
    dai = new ethers.Contract(daiAddress, erc20Abi, provider);
    usdc = new ethers.Contract(usdcAddress, erc20Abi, provider);
    usdt = new ethers.Contract(usdtAddress, erc20Abi, provider);

    wethHolder = ethers.provider.getSigner(wethHolderAddress);
    daiHolder = ethers.provider.getSigner(daiHolderAddress);
    usdcHolder = ethers.provider.getSigner(usdcHolderAddress);
    usdtHolder = ethers.provider.getSigner(usdtHolderAddress);
  });

  it('upgrades cyWeth', async () => {
    await check(cyWeth, cyWethAddress, weth, wethHolderAddress, toWei('0.1'));
  });

  it('upgrades cyDai', async () => {
    await check(cyDai, cyDaiAddress, dai, daiHolderAddress, toWei('1'));
  });

  it('upgrades cyUsdc', async () => {
    await check(cyUsdc, cyUsdcAddress, usdc, usdcHolderAddress, '1000000');
  });

  it('upgrades cyUsdt', async () => {
    await check(cyUsdt, cyUsdtAddress, usdt, usdtHolderAddress, '1000000');
  });

  async function check(cToken, cTokenAddress, token, tokenHolderAddress, amount) {
    const creamMultisig = ethers.provider.getSigner(creamMultisigAddress);
    const tokenHolder = ethers.provider.getSigner(tokenHolderAddress);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    await cTokenAdmin.connect(creamMultisig)._setImplementation(cTokenAddress, newImplementationAddress, true, '0x00');
    expect(await cToken.implementation()).to.equal(newImplementationAddress);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [tokenHolderAddress]
    });

    // Approve.
    await token.connect(tokenHolder).approve(cTokenAddress, MAX);

    const balance1 = await token.balanceOf(tokenHolderAddress);

    // Mint.
    await cToken.connect(tokenHolder).mint(amount);
    const balance2 = await token.balanceOf(tokenHolderAddress);
    expect(await cToken.balanceOf(tokenHolderAddress)).to.gt(0);
    expect(balance1.sub(balance2)).to.eq(amount);

    // Redeem.
    await cToken.connect(tokenHolder).redeemUnderlying(amount);
    const balance3 = await token.balanceOf(tokenHolderAddress);
    expect(balance3.sub(balance2)).to.eq(amount);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [tokenHolderAddress]
    });
  }
});
