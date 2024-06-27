// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Collateralized Loan Contract
contract CollateralizedLoan {
    // Define the structure of a loan
    struct Loan {
        address payable borrower;
        // Hint: Add a field for the lender's address
        uint collateralAmount;
        // Hint: Add fields for loan amount, interest rate, due date, isFunded, isRepaid
        address payable lender;
        uint256 loanAmount;
        uint256 interestRate;
        uint256 duration;
        uint256 startTime;
        uint256 amountRepaid;
        bool funded;
        bool repaid;
    }

    // Create a mapping to manage the loans
    mapping(uint256 => Loan) public loans;
    uint256 public nextLoanId;

    // Hint: Define events for loan requested, funded, repaid, and collateral claimed
    event LoanRequested(uint256 loanId, address indexed borrower, uint256 collateralAmount, uint256 loanAmount);
    event LoanFunded(uint256 loanId, address indexed lender, uint256 loanAmount);
    event LoanRepaid(uint256 loanId, address indexed borrower, uint256 repaymentAmount);
    event CollateralClaimed(uint256 loanId, address indexed lender);
    event PartialRepayment(uint256 loanId, address indexed borrower, uint256 amountRepaid);


    // Custom Modifiers
    // Hint: Write a modifier to check if a loan exists
    // Hint: Write a modifier to ensure a loan is not already funded
    modifier onlyBorrower(uint256 _loanId) {
        require(loans[_loanId].borrower == msg.sender, "Only borrower can perform this action");
        _;
    }

    modifier onlyLender(uint256 _loanId) {
        require(loans[_loanId].lender == msg.sender, "Only lender can perform this action");
        _;
    }

    modifier loanFunded(uint256 _loanId) {
        require(loans[_loanId].funded, "Loan not funded");
        _;
    }

    modifier loanNotRepaid(uint256 _loanId) {
        require(!loans[_loanId].repaid, "Loan already repaid");
        _;
    }

    // Function to deposit collateral and request a loan
    function depositCollateralAndRequestLoan(uint _interestRate, uint _duration) external payable {
        // Hint: Check if the collateral is more than 0
        require(msg.value > 0, "Collateral amount must be greater than 0");
        // Hint: Increment nextLoanId and create a new loan in the loans mapping
        nextLoanId++;

        // Hint: Calculate the loan amount based on the collateralized amount
        uint256 loanAmount = msg.value / 2; // the loan amount will be half of the collateral
        loans[nextLoanId] = Loan({
            borrower: payable(msg.sender),
            lender: payable(address(0)),
            collateralAmount: msg.value,
            loanAmount: loanAmount,
            interestRate: _interestRate,
            duration: _duration,
            startTime: 0,
            amountRepaid: 0,
            funded: false,
            repaid: false
        });

        // Hint: Emit an event for loan request
        emit LoanRequested(nextLoanId, msg.sender, msg.value, loanAmount);
    }

    // Function to fund a loan
    // Hint: Write the fundLoan function with necessary checks and logic
    // sender become a lender
    function fundLoan(uint256 _loanId) external payable loanNotRepaid(_loanId) {
        Loan storage loan = loans[_loanId];
        require(!loan.funded, "Loan already funded");
        require(msg.value == loan.loanAmount, "Incorrect loan amount: ");

        loan.lender = payable(msg.sender);
        loan.funded = true;
        loan.startTime = block.timestamp;
        loan.borrower.transfer(loan.loanAmount);

        emit LoanFunded(_loanId, msg.sender, loan.loanAmount);
    }

    // Function to repay a loan
    // Hint: Write the repayLoan function with necessary checks and logic
    function repayLoan(uint256 _loanId) external payable loanFunded(_loanId) loanNotRepaid(_loanId) onlyBorrower(_loanId) {
        Loan storage loan = loans[_loanId];
        uint256 interest = loan.loanAmount * loan.interestRate / 100;
        uint256 totalRepayment = loan.loanAmount + interest;

        if (block.timestamp < loan.startTime + loan.duration / 2) {
            // Early repayment rebate
            totalRepayment -= interest / 2;
        }

        uint256 remainingRepayment = totalRepayment - loan.amountRepaid;

        require(msg.value >= remainingRepayment, "Incorrect repayment amount");

        loan.repaid = true;
        if (msg.value > remainingRepayment) {
            // Refund the excess amount to the borrower
            loan.lender.transfer(remainingRepayment);
            loan.borrower.transfer(loan.collateralAmount + msg.value - remainingRepayment);
        } else {
            loan.lender.transfer(msg.value);
            loan.borrower.transfer(loan.collateralAmount);
        }

        emit LoanRepaid(_loanId, msg.sender, msg.value);
    }


    // Function to claim collateral on default
    // Hint: Write the claimCollateral function with necessary checks and logic
    function claimCollateral(uint256 _loanId) external loanFunded(_loanId) loanNotRepaid(_loanId) onlyLender(_loanId) {
        Loan storage loan = loans[_loanId];
        require(block.timestamp >= loan.startTime + loan.duration, "Loan duration not yet passed");

        loan.lender.transfer(loan.collateralAmount);

        emit CollateralClaimed(_loanId, msg.sender);
    }

    function partialRepayment(uint256 _loanId) external payable loanFunded(_loanId) loanNotRepaid(_loanId) onlyBorrower(_loanId) {
        Loan storage loan = loans[_loanId];
        require(msg.value > 0, "Partial repayment must be greater than 0");

        loan.amountRepaid += msg.value;
        loan.lender.transfer(msg.value);

        emit PartialRepayment(_loanId, msg.sender, msg.value);
    }
}