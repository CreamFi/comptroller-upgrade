const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const comptrollerAbi = require('../abi/comptroller');
const cTokenAbi = require('../abi/ctoken');
const erc20Abi = require('../abi/erc20');
const wftmAbi = require('../abi/wftm');

describe('crWFTM', () => {
  const toWei = ethers.utils.parseEther;
  const provider = waffle.provider;
  const MAX = ethers.constants.MaxUint256;

  let account;
  let crWFTM;

  const comptrollerAddress = '0x4250A6D3BD57455d7C6821eECb6206F507576cD2';
  const timeBasedCCEDelegate = '0x468a7BF78f11Da82c90b17a93adb7B14999aF5AB';
  const crWFTMAddress = '0xd528697008aC67A21818751A5e3c58C8daE54696';
  const wFTMAddress = '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83';
  const creamMultisigAddress = '0x197939c1ca20C2b506d6811d8B6CDB3394471074';

  beforeEach(async () => {
    account = (await ethers.getSigners())[0];
    const creamMultisig = await ethers.provider.getSigner(creamMultisigAddress);

    crWFTM = new ethers.Contract(crWFTMAddress, cTokenAbi, provider);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    const comptroller = new ethers.Contract(comptrollerAddress, comptrollerAbi, creamMultisig);
    await comptroller._supportMarket(crWFTMAddress);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });
  });

  it('upgrades', async () => {
    const wftm = new ethers.Contract(wFTMAddress, wftmAbi, provider);
    await wftm.connect(account).deposit({value: toWei('100')});
    await wftm.connect(account).approve(crWFTMAddress, MAX);

    console.log('wFTM balance:', ethers.utils.formatEther(await wftm.balanceOf(account.address)));

    const tx = await crWFTM.connect(account).mint(toWei('100'));
    const receipt = await tx.wait();
    console.log(receipt);

    console.log('timestamp', (await provider.getBlock(receipt.blockNumber)).timestamp);

    const balance2 = await crWFTM.balanceOf(account.address);
    console.log('balance:', ethers.utils.formatUnits(balance2, 8));
  });

  it('should have correct borrow interest', async () => {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    const creamMultisig = await ethers.provider.getSigner(creamMultisigAddress);

    const comptroller = new ethers.Contract(comptrollerAddress, comptrollerAbi, creamMultisig);
    // set WFTM collateral to 90%
    await comptroller._setCollateralFactor(crWFTMAddress, toWei('0.9'));

    const FixedRateModel = await ethers.getContractFactory('FixedRateModel')
    const irm = await FixedRateModel.connect(creamMultisig).deploy();

    // set crWFTM interest rate to 0.0005% per second
    const crWFTM = new ethers.Contract(crWFTMAddress, cTokenAbi, creamMultisig);
    await crWFTM.connect(creamMultisig)._setInterestRateModel(irm.address);

    // mint some wftm
    const wftm = new ethers.Contract(wFTMAddress, wftmAbi, provider);
    await wftm.connect(account).deposit({value: toWei('1000')});
    await wftm.connect(account).approve(crWFTMAddress, MAX);

    await comptroller.connect(account).enterMarkets([crWFTMAddress]);

    // supply 100 wftm to crWFTM
    await crWFTM.connect(account).mint(toWei('1000'));
    // borrow 100 wftm
    await crWFTM.connect(account).borrow(toWei('100'));

    const currentTimestamp = (await provider.getBlock(provider.getBlockNumber())).timestamp;
    // advance 10 secs
    await hre.network.provider.request({
      method: "evm_mine",
      params: [currentTimestamp + 10]
    });

    // interest = 100 * 0.0005% * 10 sec = 0.005
    const borrowBalance = await crWFTM.connect(creamMultisig).callStatic.borrowBalanceCurrent(account.address);
    expect(borrowBalance).to.equal(ethers.BigNumber.from(toWei('100.005')))
  });
});
