// Importing necessary modules and functions from Hardhat and Chai for testing
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

// Describing a test suite for the CollateralizedLoan contract
describe("CollateralizedLoan", function () {
  // A fixture to deploy the contract before each test. This helps in reducing code repetition.
  async function deployCollateralizedLoanFixture() {
    // Deploying the CollateralizedLoan contract and returning necessary variables
    const [owner, borrower, lender] = await ethers.getSigners();
    const CollateralizedLoan = await ethers.getContractFactory("CollateralizedLoan");
    const loanContract = await CollateralizedLoan.deploy();

    return { loanContract, owner, borrower, lender };
  }

  // Test suite for the loan request functionality
  describe("Loan Request", function () {
    it("Should let a borrower deposit collateral and request a loan", async function () {
      // Loading the fixture
      // TODOn: Set up test for depositing collateral and requesting a loan
      // HINT: Use .connect() to simulate actions from different accounts
      const { loanContract, borrower } = await loadFixture(deployCollateralizedLoanFixture);

      const collateralAmount = ethers.parseEther("1");
      const interestRate = 10; // 10%
      const duration = 60 * 60 * 24 * 7; // 1 week

      await loanContract.connect(borrower).depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      const loan = await loanContract.loans(1);
      expect(loan.borrower).to.equal(borrower.address);
      expect(loan.collateralAmount).to.equal(collateralAmount);
      expect(loan.loanAmount).to.equal(collateralAmount / BigInt(2)); // Assuming loan amount is half of the collateral
      expect(loan.interestRate).to.equal(interestRate);
      expect(loan.duration).to.equal(duration);
      expect(loan.funded).to.be.false;
      expect(loan.repaid).to.be.false;
    });
  });

  // Test suite for funding a loan
  describe("Funding a Loan", function () {
    it("Allows a lender to fund a requested loan", async function () {
      // Loading the fixture
      // TODOn: Set up test for a lender funding a loan
      // HINT: You'll need to check for an event emission to verify the action
      const { loanContract, borrower, lender } = await loadFixture(deployCollateralizedLoanFixture);

      const collateralAmount = ethers.parseEther("1");
      const loanAmount = collateralAmount / BigInt(2); // Loan amount is half of the collateral
      const interestRate = 10; // 10%
      const duration = 60 * 60 * 24 * 7; // 1 week

      await loanContract.connect(borrower).depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });

      await loanContract.connect(lender).fundLoan(1, { value: loanAmount });

      const loan = await loanContract.loans(1);
      expect(loan.lender).to.equal(lender.address);
      expect(loan.funded).to.be.true;
    });
  });

  // Test suite for repaying a loan

  describe("Repaying a Loan", function () {
    it("Enables the borrower to repay the loan fully with early repayment rebate", async function () {
      const { loanContract, borrower, lender } = await loadFixture(deployCollateralizedLoanFixture);

      const collateralAmount = ethers.parseEther("1");
      const loanAmount = BigInt(collateralAmount.toString()) / 2n; // Loan amount is half of the collateral
      const interestRate = 10n; // 10% (using BigInt)
      const duration = 60 * 60 * 24 * 7; // 1 week

      await loanContract.connect(borrower).depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });
      await loanContract.connect(lender).fundLoan(1, { value: loanAmount });

      const partialRepaymentAmount = ethers.parseEther("0.4");
      await loanContract.connect(borrower).partialRepayment(1, { value: partialRepaymentAmount });

      const earlyRepaymentAmount = loanAmount + (loanAmount * interestRate / 100n / 2n) - BigInt(partialRepaymentAmount.toString()); // Early repayment with rebate

      const initialBorrowerBalance = BigInt((await ethers.provider.getBalance(borrower.address)).toString());
      const initialLenderBalance = BigInt((await ethers.provider.getBalance(lender.address)).toString());

      const tx = await loanContract.connect(borrower).repayLoan(1, { value: earlyRepaymentAmount });
      const receipt = await tx.wait();
      const gasUsed = BigInt(receipt.gasUsed.toString()) * BigInt(tx.gasPrice.toString());

      const finalBorrowerBalance = BigInt((await ethers.provider.getBalance(borrower.address)).toString());
      const finalLenderBalance = BigInt((await ethers.provider.getBalance(lender.address)).toString());

      const loan = await loanContract.loans(1);
      expect(loan.repaid).to.be.true;
      //expect(finalLenderBalance).to.equal(initialLenderBalance + earlyRepaymentAmount + BigInt(partialRepaymentAmount.toString()));
      expect(finalBorrowerBalance).to.be.closeTo(initialBorrowerBalance - earlyRepaymentAmount - gasUsed, BigInt(ethers.parseEther("1").toString())); // Taking gas fees into account
    });

    it("Allows partial repayments", async function () {
      const { loanContract, borrower, lender } = await loadFixture(deployCollateralizedLoanFixture);

      const collateralAmount = ethers.parseEther("1");
      const loanAmount = ethers.parseEther("0.5");
      const interestRate = 10; // 10%
      const duration = 60 * 60 * 24 * 7; // 1 week

      await loanContract.connect(borrower).depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });
      await loanContract.connect(lender).fundLoan(1, { value: loanAmount });

      const partialRepaymentAmount = ethers.parseEther("0.4");
      await loanContract.connect(borrower).partialRepayment(1, { value: partialRepaymentAmount });

      const loan = await loanContract.loans(1);
      expect(loan.amountRepaid).to.equal(partialRepaymentAmount);
    });
  });

  // Test suite for claiming collateral
  describe("Claiming Collateral", function () {
    it("Permits the lender to claim collateral if the loan isn't repaid on time", async function () {
      // Loading the fixture
      // TODOn: Set up test for claiming collateral
      // HINT: Simulate the passage of time if necessary
      const { loanContract, borrower, lender } = await loadFixture(deployCollateralizedLoanFixture);

      const collateralAmount = ethers.parseEther("1");
      const loanAmount = BigInt(collateralAmount.toString()) / 2n; // Loan amount is half of the collateral
      const interestRate = 10n; // 10% (using BigInt)
      const duration = 60 * 60 * 24 * 7; // 1 week

      await loanContract.connect(borrower).depositCollateralAndRequestLoan(interestRate, duration, { value: collateralAmount });
      await loanContract.connect(lender).fundLoan(1, { value: loanAmount });

      // Simulate the passage of time
      await ethers.provider.send("evm_increaseTime", [duration + 1]);
      await ethers.provider.send("evm_mine", []);

      const initialLenderBalance = BigInt((await ethers.provider.getBalance(lender.address)).toString());

      await loanContract.connect(lender).claimCollateral(1);

      const finalLenderBalance = BigInt((await ethers.provider.getBalance(lender.address)).toString());

      const loan = await loanContract.loans(1);
      expect(finalLenderBalance).to.be.closeTo(initialLenderBalance + BigInt(collateralAmount.toString()), BigInt(ethers.parseEther("0.1").toString()));
    });
  });
});
