const accountModel = require('../models/account.model')

async function createAccountController(req , res) {
    const user = req.user ;

    const account = await accountModel.create({
        userId : user._id
    })

    res.status(201).json({
        account
    })


}

/**
 * Get the balance of the user's active accounts
 * 
 */
async function getBalanceController(req,res){
  const accountId = req.params.accountId ;
  const account = await accountModel.findOne({
    _id : accountId,
    userId : req.user._id
  })

  if(!account){
    return res.status(404).json({
      message : "Account not found"
    })
  }

  const balance = await account.getBalance();

  res.status(200).json({
    accountId : account._id,
    balance
  })
}

async function getAllAccountsController(req,res){
  const user = req.user ;
  const accounts = await accountModel.find({
    userId : user._id,
  })

  res.status(200).json({
    accounts
  })
}



module.exports = {createAccountController, getBalanceController, getAllAccountsController}