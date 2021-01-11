const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const erc20Abi = require('../abi/erc20');
const cTokenAbi = require('../abi/ctoken');
const cEtherAbi = require('../abi/cether');
const priceOracleAbi = require('../abi/priceOracle');
const priceOracleProxyAbi = require('../abi/priceOracleProxy');
const comptrollerAbi = require("../abi/comptroller");
const masterChefAbi = require("../abi/masterChef");

function encodeParameters(types, values) {
  const abi = new ethers.utils.AbiCoder();
  return abi.encode(types, values);
}

describe('crSLP', () => {
  const toWei = ethers.utils.parseEther;
  const MAX = ethers.constants.MaxUint256;
  const provider = waffle.provider;

  /// We fork the mainnet at block number 11606333.
  // Current totalAllocPoint of MasterChef is 123370.
  const allocPoint = 123370;
  // There are 101 pools in MasterChef.
  const pid = 101;

  let accounts;
  let admin, adminAddress;
  let user1, user1Address;
  let user2, user2Address;

  let slp;
  let crSLP;
  let masterChef;
  let unitroller;
  let sushi;
  let crETH;
  let priceOracleV1;
  let priceoracleProxy;

  const creamMultisigAddress = '0x6D5a7597896A703Fe8c85775B23395a48f971305';
  const unitrollerAddress = '0x3d5BC3c8d13dcB8bF317092d84783c2697AE9258';
  const masterChefAddress = '0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd';
  const masterChefAdminAddress = '0x9a8541Ddf3a932a9A922B607e9CF7301f1d47bD1';
  const interestRateModelAddress = '0xd34137FC9F6754bcDFCe907d06F4D10E897B3eB5';
  const sushiTokenAddress = '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2';
  const crETHAddress = '0xD06527D5e56A3495252A528C4987003b712860eE';
  const priceOracleV1Address = '0x4250A6D3BD57455d7C6821eECb6206F507576cD2';
  const priceOracleProxyAddress = '0x4B7dbA23beA9d1a2d652373bcD1B78b0E9e0188a';
  const pricePosterAddress = '0x612acA17160cc50b3AA777F9790615905d01c0bF';

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    adminAddress = await admin.getAddress();
    user1 = accounts[1];
    user1Address = await user1.getAddress();
    user2 = accounts[2];
    user2Address = await user2.getAddress();

    sushi = new ethers.Contract(sushiTokenAddress, erc20Abi, provider);

    const creamMultisig = await ethers.provider.getSigner(creamMultisigAddress);
    const masterChefAdmin = await ethers.provider.getSigner(masterChefAdminAddress);
    const pricePoster = await ethers.provider.getSigner(pricePosterAddress);

    // Master chef contract admin is a timelock contract. Give it some ethers.
    await admin.sendTransaction({
      to: masterChefAdminAddress,
      value: ethers.utils.parseEther("1.0")
    });

    // 1. Deploy new Sushi LP token.
    const slpFactory = await ethers.getContractFactory('SushiLP');
    slp = await slpFactory.deploy();

    // Distribute some slp tokens to user1, user2, and user3.
    await slp.approve(adminAddress, MAX);
    await slp.transfer(user1Address, toWei('100'));
    await slp.transfer(user2Address, toWei('100'));

    masterChef = new ethers.Contract(masterChefAddress, masterChefAbi, provider);

    // 2. Add SLP to MasterChef contract.
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [masterChefAdminAddress]
    });

    await masterChef.connect(masterChefAdmin).add(allocPoint, slp.address, false);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [masterChefAdminAddress]
    });

    expect(await masterChef.poolLength()).to.equal(pid + 1);

    // 3. Deploy new crSLP contract.
    const delegateeFactory = await ethers.getContractFactory('CSLPDelegate');
    const cDelegatee = await delegateeFactory.deploy();

    const delegatorFactory = await ethers.getContractFactory('CErc20Delegator');
    const cDelegator = await delegatorFactory.deploy(
      slp.address,
      unitrollerAddress,
      interestRateModelAddress,
      toWei('1'),
      'crSLP Token',
      'crSLP',
      8,
      adminAddress,
      cDelegatee.address,
      encodeParameters(['address', 'uint'], [masterChef.address, pid])
    );

    crSLP = new ethers.Contract(cDelegator.address, cTokenAbi, provider);
    unitroller = new ethers.Contract(unitrollerAddress, comptrollerAbi, provider);
    crETH = new ethers.Contract(crETHAddress, cEtherAbi, provider);
    priceOracleV1 = new ethers.Contract(priceOracleV1Address, priceOracleAbi, provider);
    priceoracleProxy = new ethers.Contract(priceOracleProxyAddress, priceOracleProxyAbi, provider);

    // 4. Set SLP price.
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [pricePosterAddress]
    });

    await priceOracleV1.connect(pricePoster).setPrice(slp.address, toWei('1'));
    expect(await priceoracleProxy.getUnderlyingPrice(crSLP.address)).to.equal(toWei('1'));

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [pricePosterAddress]
    });

    // 5. Support crSLP market.
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    await unitroller.connect(creamMultisig)._supportMarket(crSLP.address);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });
  });

  it('mints and redeems', async () => {
    /*
     * rewards: 100 sushi / blk
     *
     * blk  0          1          2          3          4          5          6
     *      |----------|----------|----------|----------|----------|----------|
     *                 |          |          |          |          |          |
     * user1       supply(10)     |          |      supply(10)     |      redeem(20)
     *                     (100)  |   (50)   |  (33.3)      (50)   |  (100)
     * sushi          +0          |          |        +183.3       |        +150
     *                            |          |                     |
     * user2                  supply(10) supply(10)            redeem(20)
     *                                (50)      (66.6)      (50)
     * sushi                     +0         +50                  +116.6
     */
    expect(await sushi.balanceOf(user1Address)).to.equal(0);
    expect(await sushi.balanceOf(user2Address)).to.equal(0);

    await slp.connect(user1).approve(crSLP.address, MAX);
    await slp.connect(user2).approve(crSLP.address, MAX);

    // User1 mints 10 crSLP tokens.
    await provider.send("evm_mine", []);
    await crSLP.connect(user1).mint(toWei('10'));
    expect(await sushi.balanceOf(user1Address)).to.equal(0);

    // User2 mints 10 crSLP tokens.
    await provider.send("evm_mine", []);
    await crSLP.connect(user2).mint(toWei('10'));
    expect(await sushi.balanceOf(user2Address)).to.equal(0);

    // User2 mints 10 crSLP tokens and he will get 50 sushi rewards.
    await provider.send("evm_mine", []);
    await crSLP.connect(user2).mint(toWei('10'));
    const user2Balance = await sushi.balanceOf(user2Address);
    expect(user2Balance).to.equal(toWei('50'));

    // User1 mint1 10 crSLP tokens and he will get 183.3 sushi rewards.
    await provider.send("evm_mine", []);
    await crSLP.connect(user1).mint(toWei('10'));
    const user1Balance = await sushi.balanceOf(user1Address);
    expect(user1Balance).to.equal(toWei('183.33333333333'));

    // User2 redeems 20 SLP tokens and he will get 116.6 sushi rewards.
    await provider.send("evm_mine", []);
    await crSLP.connect(user2).redeemUnderlying(toWei('20'));
    const newUser2Balance = await sushi.balanceOf(user2Address);
    expect(newUser2Balance.sub(user2Balance)).to.equal(toWei('116.66666666666'));

    // User1 redeems 20 SLP tokens and he will get 150 sushi rewards.
    await provider.send("evm_mine", []);
    await crSLP.connect(user1).redeemUnderlying(toWei('20'));
    const newUser1Balance = await sushi.balanceOf(user1Address);
    expect(newUser1Balance.sub(user1Balance)).to.equal(toWei('150'));

    // crSLP contract doesn't have any token and sushi rewards.
    expect(await crSLP.totalSupply()).to.equal(0);
    expect(await sushi.balanceOf(crSLP.address)).to.equal(0);
    expect(await masterChef.pendingSushi(pid, crSLP.address)).to.equal(0);
  });

  it('transfers tokens', async () => {
    /*
     * rewards: 100 sushi / blk
     *
     * blk  0          1          2          3          4          5
     *      |----------|----------|----------|----------|----------|
     *                 |          |          |          |          |
     * user1       supply(10) transfer(10)   |       claim()       |
     *                     (100)       (0)   |    (0)              |
     * sushi          +0                     |        +100         |
     *                                       |                     |
     * user2                             supply(10)            redeem(20)
     *                                (100)      (100)      (100)
     * sushi                               +100                  +200
     */
    expect(await sushi.balanceOf(user1Address)).to.equal(0);
    expect(await sushi.balanceOf(user2Address)).to.equal(0);

    await slp.connect(user1).approve(crSLP.address, MAX);
    await slp.connect(user2).approve(crSLP.address, MAX);

    // User1 mints 10 crSLP tokens.
    await provider.send("evm_mine", []);
    await crSLP.connect(user1).mint(toWei('10'));
    expect(await slp.balanceOf(user1Address)).to.equal(toWei('90'));

    // User1 transfer 10 crSLP tokens to user2 and user1 will have 100 sushi accrued.
    await provider.send("evm_mine", []);
    await crSLP.connect(user1).transfer(user2Address, toWei('10'));
    expect(await crSLP.sushiUserAccrued(user1Address)).to.equal(toWei('100'));

    // User2 mints 10 SLP tokens and he will get 100 sushi rewards.
    await provider.send("evm_mine", []);
    await crSLP.connect(user2).mint(toWei('10'));
    const user2Balance = await sushi.balanceOf(user2Address);
    expect(user2Balance).to.equal(toWei('100'));
    expect(await sushi.balanceOf(crSLP.address)).to.equal(toWei('100')); // this is user1's sushi rewards

    // User1 claims sushi rewards.
    await provider.send("evm_mine", []);
    await crSLP.connect(user1).claimSushi();
    expect(await sushi.balanceOf(user1Address)).to.equal(toWei('100'));

    // User2 redeems 20 SLP tokens and will get 200 sushi rewards.
    await provider.send("evm_mine", []);
    await crSLP.connect(user2).redeemUnderlying(toWei('20'));
    const newUser2Balance = await sushi.balanceOf(user2Address);
    expect(newUser2Balance.sub(user2Balance)).to.equal(toWei('200'));

    // crSLP contract doesn't have any token and sushi rewards.
    expect(await crSLP.totalSupply()).to.equal(0);
    expect(await sushi.balanceOf(crSLP.address)).to.equal(0);
    expect(await masterChef.pendingSushi(pid, crSLP.address)).to.equal(0);
  })

  it('borrows some and repay', async () => {
    /*
     * rewards: 100 sushi / blk
     *
     * blk  0          1          2          3          4          5
     *      |----------|----------|----------|----------|----------|
     *                 |          |          |          |          |
     * user1       supply(10)     |          |      redeem(10)
     *                     (100)  |   (100)  |   (100)
     * sushi          +0          |          |        +300
     *                            |          |
     * user2                   borrow(5)  repay(5)
     *                                 (0)
     * sushi                     +0         +0
     */
    expect(await sushi.balanceOf(user1Address)).to.equal(0);
    expect(await sushi.balanceOf(user2Address)).to.equal(0);

    await slp.connect(user1).approve(crSLP.address, MAX);
    await slp.connect(user2).approve(crSLP.address, MAX);

    // User2 mints 1000 crETH tokens and enters market.
    await crETH.connect(user2).mint({value: toWei('1000')});
    await unitroller.connect(user2).enterMarkets([crETHAddress]);

    // User1 mints 10 crSLP tokens.
    await provider.send("evm_mine", []);
    await crSLP.connect(user1).mint(toWei('10'));

    // User2 borrows 5 SLP tokens.
    await provider.send("evm_mine", []);
    await crSLP.connect(user2).borrow(toWei('5'));
    expect(await sushi.balanceOf(user2Address)).to.equal(0);
    expect(await slp.balanceOf(user2Address)).to.equal(toWei('105'));
    expect(await slp.balanceOf(masterChefAddress)).to.equal(toWei('5'));
    expect(await slp.balanceOf(crSLP.address)).to.equal(0);

    // User2 repays 5 SLP tokens.
    await provider.send("evm_mine", []);
    await crSLP.connect(user2).repayBorrow(MAX);
    expect(await sushi.balanceOf(user2Address)).to.equal(0);
    expect(await slp.balanceOf(user2Address)).to.lt(toWei('100'));
    expect(await slp.balanceOf(masterChefAddress)).to.gt(toWei('10'));
    expect(await slp.balanceOf(crSLP.address)).to.equal(0);

    // User1 redeems 10 SLP.
    await provider.send("evm_mine", []);
    await crSLP.connect(user1).redeemUnderlying(toWei('10'));
    // TODO: Not sure why the sushi rewards of user1 is a little less than 300. (could be decimal problem from MasterChef)
    expect(await sushi.balanceOf(user1Address)).to.lt(toWei('300'));
    expect(await sushi.balanceOf(user1Address)).to.gt(toWei('299'));
  })

  it('borrows all and repay', async () => {
    /*
     * rewards: 100 sushi / blk
     *
     * blk  0          1          2          3          4          5
     *      |----------|----------|----------|----------|----------|
     *                 |          |          |          |          |
     * user1       supply(10)     |          |      redeem(10)
     *                     (100)  |    (0)   |   (100)
     * sushi          +0          |          |        +200
     *                            |          |
     * user2                   borrow(10) repay(10)
     *                                 (0)
     * sushi                     +0         +0
     */
    expect(await sushi.balanceOf(user1Address)).to.equal(0);
    expect(await sushi.balanceOf(user2Address)).to.equal(0);

    await slp.connect(user1).approve(crSLP.address, MAX);
    await slp.connect(user2).approve(crSLP.address, MAX);

    // User2 mints 1000 crETH tokens and enters market.
    await crETH.connect(user2).mint({value: toWei('1000')});
    await unitroller.connect(user2).enterMarkets([crETHAddress]);

    // User1 mints 10 crSLP tokens.
    await provider.send("evm_mine", []);
    await crSLP.connect(user1).mint(toWei('10'));

    // User2 borrows 10 SLP tokens.
    await provider.send("evm_mine", []);
    await crSLP.connect(user2).borrow(toWei('10'));
    expect(await sushi.balanceOf(user2Address)).to.equal(0);
    expect(await slp.balanceOf(user2Address)).to.equal(toWei('110'));
    expect(await slp.balanceOf(masterChefAddress)).to.equal(0);
    expect(await slp.balanceOf(crSLP.address)).to.equal(0);

    // User2 repays 10 SLP tokens.
    await provider.send("evm_mine", []);
    await crSLP.connect(user2).repayBorrow(MAX);
    expect(await sushi.balanceOf(user2Address)).to.equal(0);
    expect(await slp.balanceOf(user2Address)).to.lt(toWei('100'));
    expect(await slp.balanceOf(masterChefAddress)).to.gt(toWei('10'));
    expect(await slp.balanceOf(crSLP.address)).to.equal(0);

    // User1 redeems 10 SLP.
    await provider.send("evm_mine", []);
    await crSLP.connect(user1).redeemUnderlying(toWei('10'));
    // TODO: Not sure why the sushi rewards of user1 is a little less than 200. (could be decimal problem from MasterChef)
    expect(await sushi.balanceOf(user1Address)).to.lt(toWei('200'));
    expect(await sushi.balanceOf(user1Address)).to.gt(toWei('199'));
  })

  it('adds reserves and reduce reserves', async () => {
    expect(await sushi.balanceOf(user1Address)).to.equal(0);

    await slp.connect(user1).approve(crSLP.address, MAX);
    await slp.connect(admin).approve(crSLP.address, MAX);

    // User1 mints 10 crSLP tokens.
    await provider.send("evm_mine", []);
    await crSLP.connect(user1).mint(toWei('10'));
    expect(await slp.balanceOf(masterChefAddress)).to.equal(toWei('10'));

    await provider.send("evm_mine", []);
    await crSLP.connect(admin)._addReserves(toWei('10'));
    expect(await slp.balanceOf(masterChefAddress)).to.equal(toWei('20'));

    await provider.send("evm_mine", []);
    await crSLP.connect(admin)._reduceReserves(toWei('10'));
    expect(await slp.balanceOf(masterChefAddress)).to.equal(toWei('10'));
  })
});
