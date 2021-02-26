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

    const comptroller = new ethers.Contract(comptrollerAddress, comptrollerAbi, provider);
    await comptroller.connect(creamMultisig)._supportMarket(crWFTMAddress);

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
});
