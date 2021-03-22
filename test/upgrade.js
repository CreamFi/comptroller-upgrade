const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const cTokenAbi = require('../abi/ctoken');
const erc20Abi = require('../abi/erc20');

describe('upgrades', () => {
  const toWei = ethers.utils.parseEther;
  const provider = waffle.provider;
  const MAX = ethers.constants.MaxUint256;

  let ustHolder;
  let tBtcHolder;

  const crUSTAddress = '0x51F48b638F82e8765F7a26373A2Cb4CcB10C07af';
  const ustAddress = '0xa47c8bf37f92abed4a126bda807a7b7498661acd';
  const ustHolderAddress = '0x7d8fDc8Dc8DFFC16948D3179DCca42295A29d62a';
  const crTBTCAddress = '0xF047d4bE569FB770dB143A6A90Ef203FC1295922';
  const tBtcAddress = '0x8dAEBADE922dF735c38C80C7eBD708Af50815fAa';
  const tBtcHolderAddress = '0xd4402526d907f377f68fa935ef89bf6b8f8844bf';

  before(async () => {
    const accounts = await ethers.getSigners();
    const admin = accounts[0];

    ustHolder = await ethers.provider.getSigner(ustHolderAddress);
    tBtcHolder = await ethers.provider.getSigner(tBtcHolderAddress);

    await admin.sendTransaction({
      to: ustHolderAddress,
      value: ethers.utils.parseEther("1.0")
    });
    await admin.sendTransaction({
      to: tBtcHolderAddress,
      value: ethers.utils.parseEther("1.0")
    });
  });

  it('impersonate user to mint crUST', async () => {
    const crUST = new ethers.Contract(crUSTAddress, cTokenAbi, provider);
    const balance1 = await crUST.balanceOf(ustHolderAddress);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ustHolderAddress]
    });

    const ust = new ethers.Contract(ustAddress, erc20Abi, provider);
    await ust.connect(ustHolder).approve(crUST.address, MAX);

    await crUST.connect(ustHolder).mint(toWei('1'));
    const balance2 = await crUST.balanceOf(ustHolderAddress);
    const balanceDiff = balance2.sub(balance1);
    expect(balanceDiff).to.gt(0);
    console.log('balanceDiff', balanceDiff.toString())

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [ustHolderAddress]
    });
  });

  it('impersonate user to mint crTBTC', async () => {
    const crTBTC = new ethers.Contract(crTBTCAddress, cTokenAbi, provider);
    const balance1 = await crTBTC.balanceOf(tBtcHolderAddress);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [tBtcHolderAddress]
    });

    const tBtc = new ethers.Contract(tBtcAddress, erc20Abi, provider);
    await tBtc.connect(tBtcHolder).approve(crTBTC.address, MAX);

    await crTBTC.connect(tBtcHolder).mint(toWei('1'));
    const balance2 = await crTBTC.balanceOf(tBtcHolderAddress);
    const balanceDiff = balance2.sub(balance1);
    expect(balanceDiff).to.gt(0);
    console.log('balanceDiff', balanceDiff.toString())

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [tBtcHolderAddress]
    });
  });
});
