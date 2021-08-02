const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const creamLockAbi = require('../abi/creamLock');
const erc20Abi = require("../abi/erc20");
const impersonateAccount = async (address) => {
    const signer = await ethers.provider.getSigner(address);
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [address]
    });
    return signer;
  };

describe('withdraw', () => {
  const provider = waffle.provider;
  let firstStaker;
  let accounts;
  let admin, adminAddress;

  let unitroller;
  let newComptroller;
  const creamAddress = '0x2ba592f78db6436527729929aaf6c908497cb200';
  const firstStakerAddress = '0x020cA66C30beC2c4Fe3861a94E4DB4A498A35872';
  const creamLockOneYearAddress = '0x780F75ad0B02afeb6039672E6a6CEDe7447a8b45';
  const stakedExpiredAmount = 1000; // staked 1000 CREAM in Sept 2020
  const threeMonths = 3600 * 24 * 30 * 3;
  
  beforeEach(async () => {
    firstStaker = await impersonateAccount(firstStakerAddress);
    await network.provider.send("evm_increaseTime", [threeMonths]);
    await network.provider.send("evm_mine") ;
  });

  it('time travel and unstake', async () => {
    let cream = new ethers.Contract(creamAddress, erc20Abi, provider);
    let initialBalance = await cream.balanceOf(firstStakerAddress);
    let creamLockContract = new ethers.Contract(creamLockOneYearAddress, creamLockAbi, provider);
    await creamLockContract.connect(firstStaker).withdraw(stakedExpiredAmount);
    expect(await cream.balanceOf(firstStakerAddress)).to.equal(initialBalance + stakedExpiredAmount);
  });
});
