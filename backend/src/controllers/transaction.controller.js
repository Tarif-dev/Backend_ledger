const mongoose = require("mongoose");
const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const accountModel = require("../models/account.model");
const emailService = require("../services/email.service");
const userModel = require("../models/user.model");

async function createTransaction(req, res) {
  const { fromAccount, toAccount, amount, idempotencyKey } = req.body;

  /**
   * Validate request
   */

  if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
    return res.status(400).json({
      message: "FromAccount, toAccount, amount and idempotencyKey",
    });
  }

  const fromUserAccount = await accountModel.findOne({
    _id: fromAccount,
  });
  const toUserAccount = await accountModel.findOne({
    _id: toAccount,
  });

  if (!fromUserAccount || !toUserAccount) {
    return res.status(400).json({
      message: "Invalid fromAccount or toAccount",
    });
  }

  /**
   * Validate idempotency key
   */

  const isTransactionExists = await transactionModel.findOne({
    idempotencyKey: idempotencyKey,
  });

  if (isTransactionExists) {
    if (isTransactionExists.status === "COMPLETED") {
      return res.status(200).json({
        message: "Transaction already processed",
        transaction: isTransactionExists,
      });
    }

    if (isTransactionExists.status === "PENDING") {
      return res.status(200).json({
        message: "Transaction is still processing",
      });
    }

    if (isTransactionExists.status === "FAILED") {
      return res.status(500).json({
        message: "Transaction processing failed.",
      });
    }
    if (isTransactionExists.status === "REVERSED") {
      return res.status(500).json({
        message: "Transaction reversed.",
      });
    }
  }

  /**
   * Check account status
   */

  if (
    fromUserAccount.status !== "ACTIVE" ||
    toUserAccount.status !== "ACTIVE"
  ) {
    return res.status(400).json({
      message:
        "Both fromAccount and toAccount must be ACTIVE to process transaction",
    });
  }

  /**
   * Derive Sender balance from ledger
   */
  const balance = await fromUserAccount.getBalance();

  if (balance < amount) {
    res.status(400).json({
      message: `Insufficient balance . Current balance is ${balance}. Requested amount is ${amount}`,
    });
  }

  /**
   * Create transaction (pending)
   */
  let transaction;

  try {
  const session = await mongoose.startSession();
  session.startTransaction();

  transaction = new transactionModel(
    {
      fromAccount,
      toAccount,
      amount,
      idempotencyKey,
      status: "PENDING",
    }
  );

  const debitLedgerEntry = await ledgerModel.create(
    [{
      account: fromAccount,
      amount: amount,
      transaction: transaction._id,
      type: "DEBIT",
    }],
    { session },
  );

  const creditLedgerEntry = await ledgerModel.create(
    [{
      account: toAccount,
      amount: amount,
      transaction: transaction._id,
      type: "CREDIT",
    }],
    { session },
  );

  await transactionModel.findOneAndUpdate(
    { _id: transaction._id },
    { status: "COMPLETED" },
    { session }
  )

  await session.commitTransaction();
  session.endSession();

  /**
   * Send email notification
   */
  // await emailService.sendTransactionEmail(
  //   req.user.email,
  //   req.user.name,
  //   amount,
  //   toAccount,
  // );

  return res.status(201).json({
    message: "Transaction completed successfully",
    transaction: transaction,
  });

  } catch (error) {
    return res.status(400).json({
      message: "Transaction is pending due to some error. Please try again later.",
      error : error.message
    })
  }
}

async function createInitialFundsTransaction(req, res) {
  const { toAccount, amount, idempotencyKey } = req.body;

  /**
   * Validate request
   */
  if (!toAccount || !amount || !idempotencyKey) {
    return res.status(400).json({
      message: "toAccount, amount and idempotencyKey are required",
    });
  }

  const toUserAccount = await accountModel.findOne({
    _id: toAccount,
  });

  if(!toUserAccount){
    return res.status(400).json({
      message : "Invalid toAccount"
    })
  }

  const fromUserAccount = await accountModel.findOne({
    systemUser : true,
    userId : req.user._id
  });

  if(!fromUserAccount){
    return res.status(400).json({
      message : "System account not found for the user"
    })
  }


  const session = await mongoose.startSession();
  session.startTransaction();

  const transaction = new transactionModel(
    {
      fromAccount: fromUserAccount._id,
      toAccount,
      amount,
      idempotencyKey,
      status: "PENDING",
    },
  );

  const debitLedgerEntry = await ledgerModel.create(
    [{
      account: fromUserAccount._id,
      amount: amount,
      transaction: transaction._id,
      type: "DEBIT",
    }],
    { session }
  );
  
  const creditLedgerEntry = await ledgerModel.create(
    [{
      account: toAccount,
      amount: amount,
      transaction: transaction._id,
      type: "CREDIT",
    }],
    { session }
  );  

  transaction.status = "COMPLETED";
  await transaction.save({ session });

  await session.commitTransaction();
  session.endSession();

  /**
   * Send email notification
   */
  await emailService.sendTransactionEmail(
    req.user.email,
    req.user.name,
    amount,
    toAccount,
  );

  return res.status(201).json({
    message: "Initial funds transaction completed successfully",
    transaction: transaction,
  });
}

module.exports = { createTransaction , createInitialFundsTransaction };
