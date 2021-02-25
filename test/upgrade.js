const { assert, expect } = require("chai");
const { ethers } = require("hardhat");
const cTokenAbi = require('../abi/ctoken');
const erc20Abi = require('../abi/erc20');

describe('alpha cToken', () => {

  const evilSpell = '0x560A8E3B79d23b0A525E15C6F3486c6A293DDAd2'
  const homoraBank = '0x5f5cd91070960d13ee549c9cc47e7a4cd00457bb'
  const creamMultisigAddress = '0x6D5a7597896A703Fe8c85775B23395a48f971305';

  const markets = [
    {
      symbol: 'cyWETH',
      address: '0x41c84c0e2ee0b740cf0d31f63f3b6f627dc6b393',
      whale: '0xF977814e90dA44bFA03b6295A0616a897441aceC',
      underlying: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      underlyingDecimal: 18,
    },
    {
      symbol: 'cyUSDT',
      address: '0x48759f220ed983db51fa7a8c0d2aab8f3ce4166a',
      whale: '0xF977814e90dA44bFA03b6295A0616a897441aceC',
      underlying: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      underlyingDecimal: 6,
    },
    {
      symbol: 'cyDAI',
      address: '0x8e595470ed749b85c6f7669de83eae304c2ec68f',
      whale: '0xF977814e90dA44bFA03b6295A0616a897441aceC',
      underlying: '0x6b175474e89094c44da98b954eedeac495271d0f',
      underlyingDecimal: 18,
    },
    {
      symbol: 'cyUSDC',
      address: '0x76eb2fe28b36b3ee97f3adae0c69606eedb2a37c',
      whale: '0xF977814e90dA44bFA03b6295A0616a897441aceC',
      underlying: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      underlyingDecimal: 6,
    },
  ]

  it('becomeImplementation', async () => {
    const creamMultisig = await ethers.provider.getSigner(creamMultisigAddress);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    const delegateFactory = await ethers.getContractFactory('CErc20Delegate');

    const beforeSetImplementation = await ethers.provider.getBlockNumber()

    // test _setImplementation and becomeImplementation
    for (let market of markets) {
      const cDelegate = await delegateFactory.deploy();
      const cyToken = new ethers.Contract(market.address, cTokenAbi, creamMultisig)

      let tx = await cyToken.accrueInterest()
      await tx.wait()
      const borrowBefore = await cyToken.callStatic.borrowBalanceCurrent(evilSpell)
      const exchangeRateBefore = await cyToken.callStatic.exchangeRateCurrent()

      tx = await cyToken._setImplementation(cDelegate.address, true, '0x00')
      await tx.wait()
      expect(await cyToken.implementation()).to.equal(cDelegate.address)

      const borrowAfter = await cyToken.callStatic.borrowBalanceCurrent(evilSpell)
      const exchangeRateAfter = await cyToken.callStatic.exchangeRateCurrent()
      console.log(' before: ', borrowBefore.toString())
      console.log('  after: ', borrowAfter.toString())
      console.log('  diff:  ', borrowAfter.sub(borrowBefore).toString())

      assert(borrowAfter.gte(borrowBefore), 'syncTotalBorrowsAndAlphaDebt fail')
      assert(exchangeRateAfter.gte(exchangeRateBefore), 'exchange should not drops')
    }

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });

    const afterSetImplementation = await ethers.provider.getBlockNumber()

    // check borrow and supply rate
    for (let market of markets) {
      const cyToken = new ethers.Contract(market.address, cTokenAbi, creamMultisig)

      // borrow rate will drops
      const br1 = await cyToken.borrowRatePerBlock({ blockTag: beforeSetImplementation })
      const br2 = await cyToken.borrowRatePerBlock({ blockTag: afterSetImplementation })
      const ebr2 = await cyToken.estimateBorrowRatePerBlockAfterChange(0, true, { blockTag: afterSetImplementation })
      assert(br1.gt(br2), `br1: ${br1.toString()}, br2: ${br2.toString()}`)
      assert(br2.eq(ebr2), `br2 should equal ebr2`)

      // supply rate will drops
      const sr1 = await cyToken.supplyRatePerBlock({ blockTag: beforeSetImplementation })
      const sr2 = await cyToken.supplyRatePerBlock({ blockTag: afterSetImplementation })
      const esr2= await cyToken.estimateSupplyRatePerBlockAfterChange(0, true, { blockTag: afterSetImplementation })
      assert(sr1.gt(sr2), `sr1: ${sr1.toString()}, sr2: ${sr2.toString()}`)
      assert(sr2.eq(esr2), 'sr2 should equal esr2')
    }

    const oldBlock = await ethers.provider.getBlockNumber()
    // mine 100 blocks
    for (let i = 0; i < 100; i++) {
      await ethers.provider.send('evm_mine', [])
    }
    const currentBlock = await ethers.provider.getBlockNumber()
    // ensure block forward
    assert((currentBlock - 100) >= oldBlock)

    for (let market of markets) {
      const cyToken = new ethers.Contract(market.address, cTokenAbi, creamMultisig)

      // evil spell don't need to pay interest
      const borrow1 = await cyToken.callStatic.borrowBalanceCurrent(evilSpell, { blockTag: oldBlock })
      const borrow2 = await cyToken.callStatic.borrowBalanceCurrent(evilSpell, { blockTag: currentBlock })
      assert(borrow1.eq(borrow2), `borrow1: ${borrow1.toString()} borrow2: ${borrow2.toString()}`)

      // normal borrowers need to pay interest
      const bankBorrow1 = await cyToken.callStatic.borrowBalanceCurrent(homoraBank, { blockTag: oldBlock })
      const bankBorrow2 = await cyToken.callStatic.borrowBalanceCurrent(homoraBank, { blockTag: currentBlock })
      assert(bankBorrow1.lt(bankBorrow2), `bank borrow1: ${bankBorrow1.toString()} bank borrow2: ${bankBorrow2.toString()}`)
    }

  });

  it('liquidate alpha debt', async () => {

    // let cream multisig have enough fund to liquidate evil spell
    for (let market of markets) {
      const whale = await ethers.provider.getSigner(market.whale);
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [market.whale]
      });

      const cyToken = new ethers.Contract(market.address, cTokenAbi, ethers.provider)
      const alphaDebt = await cyToken.callStatic.borrowBalanceCurrent(evilSpell)

      const underlying = new ethers.Contract(market.underlying, erc20Abi, whale)

      if (market.symbol === 'cyWETH') {
        let tx = await whale.sendTransaction({
          to: market.underlying,
          value: ethers.utils.parseEther('200000')
        })
        await tx.wait()
        tx = await whale.sendTransaction({
          to: creamMultisigAddress,
          value: ethers.utils.parseEther('10')
        })
        await tx.wait()
      }

      const tx = await underlying.transfer(creamMultisigAddress, alphaDebt)
      await tx.wait()

      await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [market.whale]
      });
    }

    // test liquidate using cream multisig
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    const creamMultisig = await ethers.provider.getSigner(creamMultisigAddress);
    const cySUSD = '0x4e3a36a633f63aee0ab57b5054ec78867cb3c0b8'

    for (let market of markets) {
      const underlying = new ethers.Contract(market.underlying, erc20Abi, creamMultisig)
      let tx = await underlying.approve(market.address, ethers.constants.MaxUint256)
      await tx.wait()

      const cyToken = new ethers.Contract(market.address, cTokenAbi, creamMultisig)
      let alphaDebt = await cyToken.callStatic.borrowBalanceCurrent(evilSpell)

      const dust = ethers.utils.parseUnits('1', market.underlyingDecimal)
      // close factor is 0.5
      while (alphaDebt.div(2).gt(dust)) {
        const repayAmount = alphaDebt.div(2)
        const totalBorrowsBefore = await cyToken.totalBorrows()
        const cashBefore = await cyToken.getCash()
        console.log(market.symbol)
        console.log(`        debt: ${alphaDebt.toString()}`)
        console.log(`repay amount: ${repayAmount.toString()}`)
        const tx = await cyToken.liquidateBorrow(evilSpell, repayAmount, cySUSD)
        await tx.wait()

        const totalBorrowsAfter = await cyToken.totalBorrows()
        const cashAfter = await cyToken.getCash()
        console.log(`borrow before: ${totalBorrowsBefore.toString()}`)
        console.log(` borrow after: ${totalBorrowsAfter.toString()}`)
        console.log(`  cash before: ${cashBefore.toString()}`)
        console.log(`   cash after: ${cashAfter.toString()}`)
        assert(cashBefore.add(repayAmount).eq(cashAfter))
        assert(totalBorrowsAfter.lt(totalBorrowsBefore))
        const newAlphaDebt = await cyToken.callStatic.borrowBalanceCurrent(evilSpell)
        assert(newAlphaDebt.lt(alphaDebt),
          `${market.symbol} debt not paid before ${alphaDebt.toString()} after: ${newAlphaDebt.toString()}`)
        alphaDebt = newAlphaDebt
      }
    }
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });

  })

  it('evil spell borrow more', async () => {

    const ethWhale = '0x00000000219ab540356cBB839Cbe05303d7705Fa'
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ethWhale]
    });

    const whale = await ethers.provider.getSigner(ethWhale);
    let tx = await whale.sendTransaction({
      to: evilSpell,
      value: ethers.utils.parseEther('2000001')
    })
    await tx.wait()

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [ethWhale]
    });


    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [evilSpell]
    });

    const weth = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
    const evil = await ethers.provider.getSigner(evilSpell)
    tx = await evil.sendTransaction({
      to: weth,
      value: ethers.utils.parseEther('2000000')
    })
    await tx.wait()

    const cyWETH = new ethers.Contract('0x41c84c0e2ee0b740cf0d31f63f3b6f627dc6b393', cTokenAbi, evil)

    const WETH = new ethers.Contract(weth, erc20Abi, evil)
    tx = await WETH.approve(cyWETH.address, ethers.constants.MaxUint256)
    await tx.wait()
    const b = await WETH.balanceOf(evilSpell)

    tx = await cyWETH.mint(ethers.utils.parseEther('1000000'))
    await tx.wait()

    for (let market of markets) {
      const cyToken = new ethers.Contract(market.address, cTokenAbi, evil)

      const borrowBalanceBefore = await cyToken.callStatic.borrowBalanceCurrent(evilSpell)
      const borrowAmount = ethers.utils.parseUnits('10', market.underlyingDecimal)
      tx = await cyToken.borrow(borrowAmount)
      await tx.wait()
      const borrowBalanceAfter = await cyToken.callStatic.borrowBalanceCurrent(evilSpell)
      assert(borrowBalanceBefore.add(borrowAmount).eq(borrowBalanceAfter))
      console.log(`evil borrow before: ${borrowBalanceBefore.toString()}`)
      console.log(` evil borrow after: ${borrowBalanceAfter.toString()}`)
    }

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [evilSpell]
    });

  })

});
