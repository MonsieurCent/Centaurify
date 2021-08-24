// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./interfaces/IERC20.sol";
import "./interfaces/IERC20Metadata.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IUniswapV2Router01.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./abstracts/Context.sol";
import "./abstracts/Ownable.sol";

/**
 * @dev Implementation of the {IERC20} interface.
 *
 * This implementation is agnostic to the way tokens are created. This means
 * that a supply mechanism has to be added in a derived contract using {_mint}.
 * For a generic mechanism see {ERC20PresetMinterPauser}.
 *
 * Additionally, an {Approval} event is emitted on calls to {transferFrom}.
 * This allows applications to reconstruct the allowance for all accounts just
 * by listening to said events. Other implementations of the EIP may not emit
 * these events, as it isn't required by the specification.
 *
 * Finally, the non-standard {decreaseAllowance} and {increaseAllowance}
 * functions have been added to mitigate the well-known issues around setting
 * allowances. See {IERC20-approve}.
 */
contract ERC20 is Context, IERC20, IERC20Metadata, Ownable {
    mapping(address => mapping(address => uint256)) private _allowances;
    mapping (address => uint256) private _rOwned;
    mapping (address => uint256) private _tOwned;
    mapping (address => bool) private _isExcludedFromFee;

    mapping (address => bool) private _isExcluded;
    address[] private _excluded;

    address constant UNISWAPV2ROUTER = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    /**
     * Dev comments - change 0x0000000000000000000000000000000000000000 address
     */
    address public constant _marketingWalletAddress = 0x0000000000000000000000000000000000000000;
    address public constant _operationalWalletAddress = 0x0000000000000000000000000000000000000000;
    
    uint256 private constant MAX = ~uint256(0);
    uint256 private _tTotal = 1000000000 * 10**9;
    uint256 private _rTotal = (MAX - (MAX % _tTotal));
    uint256 private _tFeeTotal;
    uint256 public _operatingFeeBalance;

    string private constant _name = "Centaurify";
    string private constant _symbol = "CENT";
    uint8 private constant _decimals = 9;
    
    /**
     * Fee - 10%
     */
    uint256 public _taxFee = 3;
    uint256 private _previousTaxFee = _taxFee;
    
    uint256 public _liquidityFee = 2;
    uint256 private _previousLiquidityFee = _liquidityFee;  
    
    uint256 public _transactionBurn = 2;
    uint256 private _previousTransactionBurn = _transactionBurn;
    
    uint256 public _marketingFee = 2;
    uint256 private _previousMarketingFee = _marketingFee;
    
    uint256 public _operatingFee = 1;
    uint256 private _previousOperatingFee = _operatingFee;
    
    IUniswapV2Router02 public immutable uniswapV2Router;
    address public immutable uniswapV2Pair;
    
    bool inSwapAndLiquify;
    bool public swapAndLiquifyEnabled = true;
    
    uint256 public _maxTxAmount = 5000 * 10**9;
    uint256 private constant numTokensSellToAddToLiquidity = 10 * 10**9;
    
    event MinTokensBeforeSwapUpdated(uint256 minTokensBeforeSwap);
    event SwapAndLiquifyEnabledUpdated(bool enabled);
    event SwapAndLiquify(
        uint256 tokensSwapped,
        uint256 ethReceived,
        uint256 tokensIntoLiquidity
    );
    event FeeInEthUpdated(bool status);
    event ExcludedFromReward(address userAccount);
    event IncludedInReward(address userAccount);
    event ExcludedFromFee(address userAccount);
    event IncludedInFee(address UserAccount);
    event TaxFeePercentUpdated(uint256 newTaxFeePercent);
    event LiquidityFeePercentUpdated(uint256 newLiquidityFeePercent);
    event BurnPercentUpdated(uint256 newBurnPercent);
    event MarketingFeePercentUpdated(uint256 newMarketingFeePercent);
    event VestingAddressUpdated(address vestingContractAddress);
    event ExternalTokenTransfered(address externalAddress,address toAddress, uint amount);
    event LiquidityAddedFromSwap(uint amountToken,uint amountEth,uint liquidity);
    event EthFromContractTransferred(uint amount);

    modifier lockTheSwap {
        inSwapAndLiquify = true;
        _;
        inSwapAndLiquify = false;
    }
    
    uint256 _amount_burnt = 0;
    bool public _feeInETH = true;

    address public vesting_address;

    /**
     * @dev Sets the values for {name} and {symbol}.
     *
     * All two of these values are immutable: they can only be set once during
     * construction.
     */
    constructor() {
        _rOwned[_msgSender()] = _rTotal;
        
        IUniswapV2Router02 _uniswapV2Router = IUniswapV2Router02(UNISWAPV2ROUTER);
         // Create a uniswap pair for this new token
        uniswapV2Pair = IUniswapV2Factory(_uniswapV2Router.factory())
            .createPair(address(this), _uniswapV2Router.WETH());

        // set the rest of the contract variables
        uniswapV2Router = _uniswapV2Router;
        
        //exclude owner and this contract from fee
        _isExcludedFromFee[owner()] = true;
        _isExcludedFromFee[address(this)] = true;
        
        emit Transfer(address(0), _msgSender(), _tTotal);
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() external view virtual override returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() external view virtual override returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5,05` (`505 / 10 ** 2`).
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() external view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() public view virtual override returns (uint256) {
        return _tTotal - _amount_burnt;
    }

    /**
     * @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address account) public view virtual override returns (uint256) {
        if (_isExcluded[account]) return _tOwned[account];
        return tokenFromReflection(_rOwned[account]);
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `recipient` cannot be the zero address.
     * - the caller must have a balance of at least `amount`.
     */
    function transfer(address recipient, uint256 amount) external virtual override returns (bool) {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    /**
     * @dev See {IERC20-allowance}.
     */
    function allowance(address owner, address spender) external view virtual override returns (uint256) {
        return _allowances[owner][spender];
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 amount) external virtual override returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of {ERC20}.
     *
     * Requirements:
     *
     * - `sender` and `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     * - the caller must have allowance for ``sender``'s tokens of at least
     * `amount`.
     */
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external virtual override returns (bool) {
        _transfer(sender, recipient, amount);

        uint256 currentAllowance = _allowances[sender][_msgSender()];
        require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");
        unchecked {
            _approve(sender, _msgSender(), currentAllowance - amount);
        }

        return true;
    }

    /**
     * @dev Atomically increases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function increaseAllowance(address spender, uint256 addedValue) external virtual returns (bool) {
        _approve(_msgSender(), spender, _allowances[_msgSender()][spender] + addedValue);
        return true;
    }

    /**
     * @dev Atomically decreases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     * - `spender` must have allowance for the caller of at least
     * `subtractedValue`.
     */
    function decreaseAllowance(address spender, uint256 subtractedValue) external virtual returns (bool) {
        uint256 currentAllowance = _allowances[_msgSender()][spender];
        require(currentAllowance >= subtractedValue, "ERC20: decreased allowance below zero");
        unchecked {
            _approve(_msgSender(), spender, currentAllowance - subtractedValue);
        }

        return true;
    }
    
    /**
     * @dev Destroys `amount` tokens from the caller.
     *
     * See {ERC20-_burn}.
     */
    function burn(uint256 amount) external virtual returns (bool) {
        _burn(_msgSender(), amount);
        return true;
    }

    function setFeeInETH(bool feeInETH) external virtual onlyOwner() {
        _feeInETH = feeInETH;
        emit FeeInEthUpdated(_feeInETH);
    }

    /**
     * @dev Moves tokens `amount` from `sender` to `recipient`.
     *
     * This is internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * Requirements:
     *
     * - `sender` cannot be the zero address.
     * - `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     */
    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");
        require(amount > 0, "Transfer amount must be greater than zero");

        _beforeTokenTransfer(sender, recipient, amount);

        uint256 senderBalance = balanceOf(sender);
        require(senderBalance >= amount, "ERC20: transfer amount exceeds balance");
        
        //indicates if fee should be deducted from transfer
        bool takeFee = true;
        //if any account belongs to _isExcludedFromFee account then remove the fee
        if(_isExcludedFromFee[sender] || _isExcludedFromFee[recipient]){
            takeFee = false;
        }
        _swapAndLiquify(sender);
            
       //transfer amount, it will take tax, burn, liquidity fee
        _tokenTransfer(sender, recipient, amount, takeFee);
    }

    /**
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     */
    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: burn from the zero address");

        _beforeTokenTransfer(account, address(0), amount);

        uint256 accountBalance = _rOwned[account];
        require(accountBalance >= amount, "ERC20: burn amount exceeds balance");
        unchecked {
            _rOwned[account] = accountBalance - amount;
        }
        _tTotal -= amount;

        emit Transfer(account, address(0), amount);
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over the `owner` s tokens.
     *
     * This internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     */
    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    /**
     * @dev Hook that is called before any transfer of tokens. This includes
     * minting and burning.
     *
     * Calling conditions:
     *
     * - when `from` and `to` are both non-zero, `amount` of ``from``'s tokens
     * will be to transferred to `to`.
     * - when `from` is zero, `amount` tokens will be minted for `to`.
     * - when `to` is zero, `amount` of ``from``'s tokens will be burned.
     * - `from` and `to` are never both zero.
     *
     * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}
    
    function tokenFromReflection(uint256 rAmount) public view returns(uint256) {
        require(rAmount <= _rTotal, "Amount must be less than total reflections");
        uint256 currentRate =  _getRate();
        return rAmount / currentRate;
    }
    
    function isExcludedFromReward(address account) external view returns (bool) {
        return _isExcluded[account];
    }

    function totalFees() external view returns (uint256) {
        return _tFeeTotal;
    }
    
    function excludeFromReward(address account) external onlyOwner() {
        require(!_isExcluded[account], "Account is already excluded");
        if(_rOwned[account] > 0) {
            _tOwned[account] = tokenFromReflection(_rOwned[account]);
        }
        _isExcluded[account] = true;
        _excluded.push(account);
        emit ExcludedFromReward(account);
    }
    
    function includeInReward(address account) external onlyOwner() {
        require(_isExcluded[account], "Account is already excluded");
        for (uint256 i = 0; i < _excluded.length; i++) {
            if (_excluded[i] == account) {
                _excluded[i] = _excluded[_excluded.length - 1];
                _tOwned[account] = 0;
                _isExcluded[account] = false;
                _excluded.pop();
                emit IncludedInReward(account);
                break;
            }
        }
    }
    
    function excludeFromFee(address account) external onlyOwner {
        _isExcludedFromFee[account] = true;
        emit ExcludedFromFee(account);
    }
    
    function includeInFee(address account) external onlyOwner {
        _isExcludedFromFee[account] = false;
        emit IncludedInFee(account);
    }
    
    function setTaxFeePercent(uint256 taxFee) external onlyOwner() {
        _taxFee = taxFee;
        emit TaxFeePercentUpdated(_taxFee);
    }
    
    function setLiquidityFeePercent(uint256 liquidityFee) external onlyOwner() {
        _liquidityFee = liquidityFee;
        emit LiquidityFeePercentUpdated(_liquidityFee);
    }
    
    function setBurnPercent(uint256 transactionBurn) external onlyOwner() {
        _transactionBurn = transactionBurn;
        emit BurnPercentUpdated(_transactionBurn);
    }
    
    function setMarketingFeePercent(uint256 marketingFee) external onlyOwner() {
        _marketingFee = marketingFee;
        emit MarketingFeePercentUpdated(_marketingFee);
    }
    
    function setMaxTxPercent(uint256 maxTxPercent) external onlyOwner() {
        _maxTxAmount = _tTotal * maxTxPercent / 10**2;
    }
    
    function setSwapAndLiquifyEnabled(bool _enabled) external onlyOwner {
        swapAndLiquifyEnabled = _enabled;
        emit SwapAndLiquifyEnabledUpdated(_enabled);
    }    
    
    //to receieve ETH from uniswapV2Router when swapping
    receive() external payable {}

    function _takeFee(uint256 rFee, uint256 tFee) internal {
        _rTotal = _rTotal - rFee;
        _tFeeTotal = _tFeeTotal + tFee;
    }
    
    function _takeLiquidity(uint256 tLiquidity) internal {
        uint256 currentRate =  _getRate();
        uint256 rLiquidity = tLiquidity * currentRate;
        _rOwned[address(this)] = _rOwned[address(this)] + rLiquidity;
        if(_isExcluded[address(this)])
            _tOwned[address(this)] = _tOwned[address(this)] + tLiquidity;
    }
    
    function _takeMarketingFee(uint256 tMarketingFee) internal {
        uint256 currentRate =  _getRate();
        uint256 rMarketingFee = tMarketingFee * currentRate;
        _rOwned[_marketingWalletAddress] = _rOwned[_marketingWalletAddress] + rMarketingFee;
        if(_isExcluded[_marketingWalletAddress])
            _tOwned[_marketingWalletAddress] = _tOwned[_marketingWalletAddress] + tMarketingFee;
    }
    
    function _takeOperatingFee(uint256 tOperatingFee) internal {
        uint256 currentRate =  _getRate();
        
        if(_feeInETH == true) {
            // eth conversion
            uint256 rOperatingFeeEth = (tOperatingFee * 25 / 10**2) / 10**2 * currentRate;
            uint256 tOperatingFeeEth = (tOperatingFee * 25 / 10**2) / 10**2;
            _rOwned[address(this)] = _rOwned[address(this)] + rOperatingFeeEth;
            _operatingFeeBalance += tOperatingFeeEth;
            if(_isExcluded[address(this)])
                _tOwned[address(this)] = _tOwned[address(this)] + tOperatingFeeEth;
            
            // Token transfer
            uint256 rOperatingFeeToken = (tOperatingFee * 75 / 10**2) / 10**2 * currentRate;
            uint256 tOperatingFeeToken = (tOperatingFee * 75 / 10**2) / 10**2;
            _rOwned[_operationalWalletAddress] = _rOwned[_operationalWalletAddress] + rOperatingFeeToken;
            if(_isExcluded[_operationalWalletAddress])
                _tOwned[_operationalWalletAddress] = _tOwned[_operationalWalletAddress] + tOperatingFeeToken;
        } else {
            uint256 rOperatingFee = tOperatingFee * currentRate;
            _rOwned[_operationalWalletAddress] = _rOwned[_operationalWalletAddress] + rOperatingFee;
            if(_isExcluded[_operationalWalletAddress])
                _tOwned[_operationalWalletAddress] = _tOwned[_operationalWalletAddress] + tOperatingFee;
        }
    }

    function _getTValues(uint256 amount) internal view returns (uint256, uint256, uint256, uint256, uint256, uint256) {
        uint256 tAmount = amount;
        uint256 tFee = calculateTaxFee(tAmount);
        uint256 tLiquidity = calculateLiquidityFee(tAmount);
        uint256 tBurn = calculateTransactionBurn(tAmount);
        uint256 tMarketingFee = calculateMarketingFee(tAmount);
        uint256 tOperatingFee = calculateOperatingFee(tAmount);
        uint256 tTransferAmount = tAmount - tFee - tLiquidity - tBurn - tMarketingFee - tOperatingFee;
        return (tTransferAmount, tFee, tLiquidity, tBurn, tMarketingFee, tOperatingFee);
    }

    function _getRValues(uint256 tAmount, uint256 tFee, uint256 tLiquidity, uint256 tBurn, uint256 tMarketingFee, uint256 tOperatingFee, uint256 currentRate) internal pure returns (uint256, uint256, uint256) {
        uint256 rAmount = tAmount * currentRate;
        uint256 rFee = tFee * currentRate;
        uint256 rLiquidity = tLiquidity * currentRate;
        uint256 rBurn = tBurn * currentRate;
        uint256 rMarketingFee = tMarketingFee * currentRate;
        uint256 rOperatingFee = tOperatingFee * currentRate;
        uint256 rTransferAmount = rAmount - rFee - rLiquidity - rBurn - rMarketingFee - rOperatingFee;
        return (rAmount, rTransferAmount, rFee);
    }
    
    function _getRate() internal view returns(uint256) {
        (uint256 rSupply, uint256 tSupply) = _getCurrentSupply();
        return rSupply / tSupply;
    }

    function _getCurrentSupply() internal view returns(uint256, uint256) {
        uint256 rSupply = _rTotal;
        uint256 tSupply = _tTotal;      
        for (uint256 i = 0; i < _excluded.length; i++) {
            if (_rOwned[_excluded[i]] > rSupply || _tOwned[_excluded[i]] > tSupply) return (_rTotal, _tTotal);
            rSupply = rSupply - _rOwned[_excluded[i]];
            tSupply = tSupply - _tOwned[_excluded[i]];
        }
        if (rSupply < _rTotal / _tTotal) return (_rTotal, _tTotal);
        return (rSupply, tSupply);
    }
    
    function calculateTaxFee(uint256 _amount) internal view returns (uint256) {
        return _amount * _taxFee / 10**2;
    }

    function calculateLiquidityFee(uint256 _amount) internal view returns (uint256) {
        return _amount * _liquidityFee / 10**2;
    }
    
    function calculateTransactionBurn(uint256 _amount) internal view returns (uint256) {
        return _amount * _transactionBurn / 10**2;
    }
    
    function calculateMarketingFee(uint256 _amount) internal view returns (uint256) {
        return _amount * _marketingFee / 10**2;
    }
    
    function calculateOperatingFee(uint256 _amount) internal view returns (uint256) {
        return _amount * _operatingFee / 10**2;
    }
    
    function removeAllFee() internal {
        if(_taxFee == 0 && _liquidityFee == 0 && _transactionBurn == 0 && _marketingFee == 0 && _operatingFee == 0) return;
        
        _previousTaxFee = _taxFee;
        _previousLiquidityFee = _liquidityFee;
        _previousTransactionBurn = _transactionBurn;
        _previousMarketingFee = _marketingFee;
        _previousOperatingFee = _operatingFee;
        
        _taxFee = 0;
        _liquidityFee = 0;
        _transactionBurn = 0;
        _marketingFee = 0;
        _operatingFee = 0;
    }
    
    function restoreAllFee() internal {
        _taxFee = _previousTaxFee;
        _liquidityFee = _previousLiquidityFee;
        _transactionBurn = _previousTransactionBurn;
        _marketingFee = _previousMarketingFee;
        _operatingFee = _previousOperatingFee;
    }
    
    function isExcludedFromFee(address account) external view returns(bool) {
        return _isExcludedFromFee[account];
    }
    
    function _swapAndLiquify(address from) internal {
        // is the token balance of this contract address over the min number of
        // tokens that we need to initiate a swap + liquidity lock?
        // also, don't get caught in a circular liquidity event.
        // also, don't swap & liquify if sender is uniswap pair.
        uint256 contractTokenBalance = balanceOf(address(this));
        
        if(contractTokenBalance >= _maxTxAmount)
        {
            contractTokenBalance = _maxTxAmount;
        }
        
        bool overMinTokenBalance = contractTokenBalance >= numTokensSellToAddToLiquidity;
        if (
            overMinTokenBalance &&
            !inSwapAndLiquify &&
            from != uniswapV2Pair &&
            swapAndLiquifyEnabled
        ) {
            contractTokenBalance = numTokensSellToAddToLiquidity;
            //add liquidity
            swapAndLiquify(contractTokenBalance);
        }
    }
    
    function swapAndLiquify(uint256 contractTokenBalance) internal lockTheSwap {
        uint256 LPtokenBalance = contractTokenBalance;
        // split the contract balance into halves
        uint256 half = LPtokenBalance / 2;
        uint256 otherHalf = LPtokenBalance - half;

        // capture the contract's current ETH balance.
        // this is so that we can capture exactly the amount of ETH that the
        // swap creates, and not make the liquidity event include any ETH that
        // has been manually sent to the contract
        uint256 initialBalance = address(this).balance;

        // swap tokens for ETH
        swapTokensForEth(half, address(this)); // <- this breaks the ETH -> HATE swap when swap+liquify is triggered

        // how much ETH did we just swap into?
        uint256 newBalance = address(this).balance - initialBalance;

        // add liquidity to uniswap
        addLiquidity(otherHalf, newBalance);
        
        if(_feeInETH == true) transferToFeeWallet();
        
        emit SwapAndLiquify(half, newBalance, otherHalf);
    }
    
    function swapTokensForEth(uint256 tokenAmount, address swapAddress) internal {
        // generate the uniswap pair path of token -> weth
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = uniswapV2Router.WETH();

        _approve(address(this), address(uniswapV2Router), tokenAmount);

        // make the swap
        uniswapV2Router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0, // accept any amount of ETH
            path,
            swapAddress,
            block.timestamp
        );
    }
    
    function addLiquidity(uint256 tokenAmount, uint256 ethAmount) internal {
        // approve token transfer to cover all possible scenarios
        _approve(address(this), address(uniswapV2Router), tokenAmount);

        // add the liquidity
        (uint amountToken, uint amountETH, uint liquidity) = uniswapV2Router.addLiquidityETH{value: ethAmount}(
            address(this),
            tokenAmount,
            0, // slippage is unavoidable
            0, // slippage is unavoidable
            owner(),
            block.timestamp
        );
        emit LiquidityAddedFromSwap(amountToken,amountETH,liquidity);
    }
    
    function transferToFeeWallet() internal {
        swapTokensForEth(_operatingFeeBalance, _operationalWalletAddress);
        _operatingFeeBalance = 0;
    }
    
    //this method is responsible for taking all fee, if takeFee is true
    function _tokenTransfer(address sender, address recipient, uint256 amount,bool takeFee) internal {
        if(!takeFee)
            removeAllFee();
        
        if (_isExcluded[sender] && !_isExcluded[recipient]) {
            _transferFromExcluded(sender, recipient, amount);
        } else if (!_isExcluded[sender] && _isExcluded[recipient]) {
            _transferToExcluded(sender, recipient, amount);
        } else if (_isExcluded[sender] && _isExcluded[recipient]) {
            _transferBothExcluded(sender, recipient, amount);
        } else {
            _transferStandard(sender, recipient, amount);
        }
        
        if(!takeFee)
            restoreAllFee();
    }
    
    function _transferStandard(address sender, address recipient, uint256 tAmount) internal {
        (uint256 tTransferAmount, uint256 tFee, uint256 tLiquidity, uint256 tBurn, uint256 tMarketingFee, uint256 tOperatingFee) = _getTValues(tAmount);
        (uint256 rAmount, uint256 rTransferAmount, uint256 rFee) = _getRValues(tAmount, tFee, tLiquidity, tBurn, tMarketingFee, tOperatingFee, _getRate());
        _rOwned[sender] = _rOwned[sender] - rAmount;
        _rOwned[recipient] = _rOwned[recipient] + rTransferAmount;
        _takeLiquidity(tLiquidity);
        _takeFee(rFee, tFee);
        if(tBurn > 0) {
            _amount_burnt += tBurn;
            emit Transfer(sender, address(0), tBurn);
        }
        _takeMarketingFee(tMarketingFee);
        _takeOperatingFee(tOperatingFee);
        emit Transfer(sender, recipient, tTransferAmount);
    }
    
    function _transferBothExcluded(address sender, address recipient, uint256 tAmount) internal {
        (uint256 tTransferAmount, uint256 tFee, uint256 tLiquidity, uint256 tBurn, uint256 tMarketingFee, uint256 tOperatingFee) = _getTValues(tAmount);
        (uint256 rAmount, uint256 rTransferAmount, uint256 rFee) = _getRValues(tAmount, tFee, tLiquidity, tBurn, tMarketingFee, tOperatingFee, _getRate());
        _tOwned[sender] = _tOwned[sender] - tAmount;
        _rOwned[sender] = _rOwned[sender] - rAmount;
        _tOwned[recipient] = _tOwned[recipient] + tTransferAmount;
        _rOwned[recipient] = _rOwned[recipient] + rTransferAmount;        
        _takeLiquidity(tLiquidity);
        _takeFee(rFee, tFee);
        if(tBurn > 0) {
            _amount_burnt += tBurn;
            emit Transfer(sender, address(0), tBurn);
        }
        _takeMarketingFee(tMarketingFee);
        _takeOperatingFee(tOperatingFee);
        emit Transfer(sender, recipient, tTransferAmount);
    }
    
    function _transferToExcluded(address sender, address recipient, uint256 tAmount) internal {
        (uint256 tTransferAmount, uint256 tFee, uint256 tLiquidity, uint256 tBurn, uint256 tMarketingFee, uint256 tOperatingFee) = _getTValues(tAmount);
        (uint256 rAmount, uint256 rTransferAmount, uint256 rFee) = _getRValues(tAmount, tFee, tLiquidity, tBurn, tMarketingFee, tOperatingFee, _getRate());
        _rOwned[sender] = _rOwned[sender] - rAmount;
        _tOwned[recipient] = _tOwned[recipient] + tTransferAmount;
        _rOwned[recipient] = _rOwned[recipient] + rTransferAmount;           
        _takeLiquidity(tLiquidity);
        _takeFee(rFee, tFee);
        if(tBurn > 0) {
            _amount_burnt += tBurn;
            emit Transfer(sender, address(0), tBurn);
        }
        _takeMarketingFee(tMarketingFee);
        _takeOperatingFee(tOperatingFee);
        emit Transfer(sender, recipient, tTransferAmount);
    }

    function _transferFromExcluded(address sender, address recipient, uint256 tAmount) internal {
        (uint256 tTransferAmount, uint256 tFee, uint256 tLiquidity, uint256 tBurn, uint256 tMarketingFee, uint256 tOperatingFee) = _getTValues(tAmount);
        (uint256 rAmount, uint256 rTransferAmount, uint256 rFee) = _getRValues(tAmount, tFee, tLiquidity, tBurn, tMarketingFee, tOperatingFee, _getRate());
        _tOwned[sender] = _tOwned[sender] - tAmount;
        _rOwned[sender] = _rOwned[sender] - rAmount;
        _rOwned[recipient] = _rOwned[recipient] + rTransferAmount;   
        _takeLiquidity(tLiquidity);
        _takeFee(rFee, tFee);
        if(tBurn > 0) {
            _amount_burnt += tBurn;
            emit Transfer(sender, address(0), tBurn);
        }
        _takeMarketingFee(tMarketingFee);
        _takeOperatingFee(tOperatingFee);
        emit Transfer(sender, recipient, tTransferAmount);
    }

    function crowdsaleApprove(address from_address, uint256 amount) external virtual returns (bool) {
        _approve(from_address, vesting_address, amount);
        return true;
    }

    function setVestingAddress(address account) external virtual onlyOwner() returns (bool){
        require(account != address(0), "ERC20: Vesting address cant be zero address");
        vesting_address = account;
        return true;
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function withdrawEthFromContract(uint256 amount) public onlyOwner {
        require(amount <= getBalance());
        address payable _owner = payable(owner());
        _owner.transfer(amount);
        emit EthFromContractTransferred(amount);
    }

    function withdrawToken(address _tokenContract, uint256 _amount) external onlyOwner {
        require(_tokenContract != address(0), "Address cant be zero address");
        IERC20 tokenContract = IERC20(_tokenContract);
        tokenContract.transfer(msg.sender, _amount);
        emit ExternalTokenTransfered(_tokenContract,msg.sender, _amount);
    }
}
