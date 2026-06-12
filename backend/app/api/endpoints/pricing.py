from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from app.core.database import get_db
from app.models.models import Produto
from app.services.peps_service import PEPSService
from pydantic import BaseModel

router = APIRouter()

# --- Schemas ---

class OnlinePricingRequest(BaseModel):
    product_id: Optional[int] = None
    custom_cost: Optional[float] = None
    marketplace: str  # "mercado_livre_classic", "mercado_livre_premium", "shopee"
    mode: int  # 1 = Selling Price, 2 = Desired Margin %, 3 = Desired Profit R$
    input_value: float
    reputation: Optional[str] = "verde"
    shipping_override: Optional[float] = None
    category: Optional[str] = None
    packaging_cost: float = 1.50
    operational_cost: float = 2.00
    tax_rate: float = 4.0

class OnlinePricingResult(BaseModel):
    price: float
    net_profit: float
    margin: float
    roi: float
    breakeven_price: float
    marketplace_fees: float
    shipping_cost: float
    tax_cost: float
    unit_cost: float
    purchase_cost: float
    packaging_cost: float
    operational_cost: float
    commission_percent_val: float
    fixed_fee_val: float

class PhysicalPricingRequest(BaseModel):
    product_id: Optional[int] = None
    custom_cost: Optional[float] = None
    mode: int  # 1 = Selling Price, 2 = Desired Margin %, 3 = Desired Profit R$
    input_value: float
    tax_rate: float = 4.0
    commission_rate: float = 2.0
    payment_fee_rate: float = 2.5
    packaging_cost: float = 0.50
    operational_cost: float = 1.00

class PhysicalPricingResult(BaseModel):
    price: float
    net_profit: float
    margin: float
    roi: float
    breakeven_price: float
    tax_cost: float
    commission_cost: float
    payment_fee_cost: float
    unit_cost: float
    purchase_cost: float
    packaging_cost: float
    operational_cost: float

class ChannelComparisonDetails(BaseModel):
    channel_name: str
    price: float
    fees: float
    shipping: float
    tax: float
    profit: float
    margin: float
    roi: float

class ComparatorRequest(BaseModel):
    product_id: int
    reference_price: Optional[float] = None
    shipping_override: Optional[float] = None
    category: Optional[str] = None
    packaging_cost_online: float = 1.50
    operational_cost_online: float = 2.00
    tax_rate_online: float = 4.0
    packaging_cost_physical: float = 0.50
    operational_cost_physical: float = 1.00
    tax_rate_physical: float = 4.0
    commission_rate_physical: float = 2.0
    payment_fee_rate_physical: float = 2.5

class ComparatorResponse(BaseModel):
    product_name: str
    sku: str
    unit_cost: float
    comparisons: List[ChannelComparisonDetails]
    best_channel: str

class SmartPricingRequest(BaseModel):
    product_id: Optional[int] = None
    custom_cost: Optional[float] = None
    category: str
    competitors: List[float]
    min_desired_margin: Optional[float] = None
    packaging_cost_online: float = 1.50
    operational_cost_online: float = 2.00
    tax_rate_online: float = 4.0
    packaging_cost_physical: float = 0.50
    operational_cost_physical: float = 1.00
    tax_rate_physical: float = 4.0
    commission_rate_physical: float = 2.0
    payment_fee_rate_physical: float = 2.5

class SmartPricingTier(BaseModel):
    strategy: str  # "Mínimo", "Ideal", "Agressivo"
    price: float
    profit: float
    margin: float
    roi: float
    safety_triggered: bool = False
    description: str

class SmartPricingResponse(BaseModel):
    mercado_livre_classic: List[SmartPricingTier]
    mercado_livre_premium: List[SmartPricingTier]
    shopee: List[SmartPricingTier]
    loja_fisica: List[SmartPricingTier]

# --- Core Logic ---

def get_ml_2026_shipping_fee(reputation: str, weight: float, price: float = 79.0) -> float:
    rep = reputation.lower()
    is_under_threshold = (price < 79.0)
    if rep == "verde":
        if weight <= 0.3: return 5.65 if is_under_threshold else 20.95
        elif weight <= 0.5: return 5.95 if is_under_threshold else 22.55
        elif weight <= 1.0: return 6.05 if is_under_threshold else 23.65
        elif weight <= 1.5: return 6.15 if is_under_threshold else 24.65
        elif weight <= 2.0: return 6.25 if is_under_threshold else 24.65
        elif weight <= 3.0: return 6.35 if is_under_threshold else 26.25
        elif weight <= 4.0: return 6.45 if is_under_threshold else 28.35
        elif weight <= 5.0: return 6.55 if is_under_threshold else 30.75
        elif weight <= 9.0: return 39.75
        elif weight <= 20.0: return 91.15
        elif weight <= 40.0: return 107.05
        elif weight <= 80.0: return 132.25
        elif weight <= 100.0: return 167.95
        elif weight <= 150.0: return 199.45
        else: return 261.95
    elif rep == "amarela":
        if weight <= 0.3: return 6.46 if is_under_threshold else 25.14
        elif weight <= 0.5: return 6.80 if is_under_threshold else 27.06
        elif weight <= 1.0: return 6.91 if is_under_threshold else 28.38
        elif weight <= 2.0: return 29.58
        elif weight <= 5.0: return 36.90
        elif weight <= 9.0: return 59.22
        elif weight <= 20.0: return 109.38
        elif weight <= 40.0: return 128.46
        elif weight <= 80.0: return 176.34
        elif weight <= 100.0: return 201.54
        elif weight <= 150.0: return 239.34
        else: return 239.34
    else:  # vermelha / base
        if weight <= 0.3: return 8.07 if is_under_threshold else 41.90
        elif weight <= 0.5: return 8.50 if is_under_threshold else 45.10
        elif weight <= 1.0: return 8.64 if is_under_threshold else 47.30
        elif weight <= 2.0: return 49.30
        elif weight <= 5.0: return 61.50
        elif weight <= 9.0: return 98.70
        elif weight <= 20.0: return 182.30
        elif weight <= 40.0: return 214.10
        elif weight <= 80.0: return 293.90
        elif weight <= 100.0: return 335.90
        elif weight <= 150.0: return 398.90
        else: return 523.90

def get_ml_variable_fixed_fee(p: float, fixed_fee_threshold: float = 79.0) -> float:
    if p >= fixed_fee_threshold:
        return 0.0
    if p < 12.50:
        return round(p * 0.50, 2)
    elif p < 29.00:
        return 6.25
    elif p < 50.00:
        return 6.50
    else:
        return 6.75

def get_ml_commission_rate(category: Optional[str], is_premium: bool) -> float:
    default_rate = 16.5 if is_premium else 11.5
    if not category:
        return default_rate
    cat_lower = category.lower().strip()
    if any(x in cat_lower for x in ["sapato", "calçado", "calçado", "brinquedo", "bebe", "veiculo", "esporte", "fitness", "ferramenta", "casa", "decoracao", "moveis", "saude"]):
        return 16.5 if is_premium else 11.5
    elif any(x in cat_lower for x in ["vestuario", "roupa", "moda", "acessorio", "beleza", "cosmetico", "joia", "relogio", "festa"]):
        return 17.5 if is_premium else 12.5
    elif any(x in cat_lower for x in ["eletronico", "celular", "computador", "tecnologia", "game", "console", "eletrodomestico", "agro", "alimento", "bebida", "instrumento"]):
        return 15.5 if is_premium else 10.5
    elif any(x in cat_lower for x in ["livro", "revista", "comic", "filme", "musica"]):
        return 15.0 if is_premium else 10.0
    return default_rate

async def solve_online_pricing(
    purchase_cost: float,
    packaging_cost: float,
    operational_cost: float,
    tax_rate: float,
    marketplace: str,
    mode: int,
    input_value: float,
    reputation: str = "verde",
    shipping_override: Optional[float] = None,
    category: Optional[str] = None,
    weight: float = 0.2
) -> OnlinePricingResult:
    unit_cost = purchase_cost + packaging_cost + operational_cost
    
    if marketplace.startswith("mercado_livre"):
        is_premium = "premium" in marketplace
        r_comm = get_ml_commission_rate(category, is_premium) / 100.0
        r_tax = tax_rate / 100.0
        
        shipping_cost_over = shipping_override if shipping_override is not None else get_ml_2026_shipping_fee(reputation, weight, price=79.0)
        shipping_cost_under = shipping_override if shipping_override is not None else 0.0 # buyer pays
        
        def solve_ml_price(target_margin: float = 0.0, target_profit: float = 0.0) -> float:
            m = target_margin
            tp = target_profit
            
            # Step 1: P < 12.50 (CVFF = P * 0.5)
            denom1 = 1.0 - r_comm - r_tax - m - 0.5
            if denom1 > 0:
                p1 = (unit_cost + shipping_cost_under + tp) / denom1
                if p1 < 12.50:
                    return p1
                    
            # Step 2: 12.50 <= P < 29.00 (CVFF = 6.25)
            denom2 = 1.0 - r_comm - r_tax - m
            if denom2 > 0:
                p2 = (unit_cost + 6.25 + shipping_cost_under + tp) / denom2
                if 12.50 <= p2 < 29.00:
                    return p2
                    
            # Step 3: 29.00 <= P < 50.00 (CVFF = 6.50)
            if denom2 > 0:
                p3 = (unit_cost + 6.50 + shipping_cost_under + tp) / denom2
                if 29.00 <= p3 < 50.00:
                    return p3
                    
            # Step 4: 50.00 <= P < 79.00 (CVFF = 6.75)
            if denom2 > 0:
                p4 = (unit_cost + 6.75 + shipping_cost_under + tp) / denom2
                if 50.00 <= p4 < 79.00:
                    return p4
                    
            # Step 5: P >= 79.00 (CVFF = 0.0)
            if denom2 > 0:
                p5 = (unit_cost + shipping_cost_over + tp) / denom2
                return max(p5, 79.00)
                
            return 79.00
            
        breakeven_price = solve_ml_price()
        
        calculated_price = 0.0
        if mode == 1:
            calculated_price = input_value
        elif mode == 2:
            calculated_price = solve_ml_price(target_margin=input_value/100.0)
        elif mode == 3:
            calculated_price = solve_ml_price(target_profit=input_value)
            
        calculated_price = round(max(calculated_price, 0.01), 2)
        cvff = get_ml_variable_fixed_fee(calculated_price)
        
        if calculated_price < 79.0:
            fees = (calculated_price * r_comm) + cvff
            commission_percent_val = calculated_price * r_comm
            fixed_fee_val = cvff
            ship = shipping_cost_under
        else:
            fees = calculated_price * r_comm
            commission_percent_val = calculated_price * r_comm
            fixed_fee_val = 0.0
            ship = shipping_cost_over
            
        tax = calculated_price * r_tax
        profit = calculated_price - unit_cost - fees - ship - tax
        margin = (profit / calculated_price) * 100.0 if calculated_price > 0 else 0.0
        roi = (profit / unit_cost) * 100.0 if unit_cost > 0 else 0.0
        
        return OnlinePricingResult(
            price=calculated_price,
            net_profit=round(profit, 2),
            margin=round(margin, 2),
            roi=round(roi, 2),
            breakeven_price=round(breakeven_price, 2),
            marketplace_fees=round(fees, 2),
            shipping_cost=round(ship, 2),
            tax_cost=round(tax, 2),
            unit_cost=round(unit_cost, 2),
            purchase_cost=purchase_cost,
            packaging_cost=packaging_cost,
            operational_cost=operational_cost,
            commission_percent_val=round(commission_percent_val, 2),
            fixed_fee_val=round(fixed_fee_val, 2)
        )
        
    elif marketplace == "shopee":
        r_comm = 0.14
        r_service = 0.06
        r_trans = 0.02
        r_tax = tax_rate / 100.0
        fixed_fee = 3.0
        
        shipping_cost = shipping_override if shipping_override is not None else 0.0
        total_rate = r_comm + r_service + r_trans + r_tax
        
        def eval_shopee_price(p: float):
            p = max(p, 0.01)
            base_fee = p * (r_comm + r_service)
            if base_fee > 100.0:
                base_fee = 100.0
            trans_fee = p * r_trans
            fees = base_fee + trans_fee + fixed_fee
            tax = p * r_tax
            profit = p - unit_cost - fees - shipping_cost - tax
            margin = (profit / p) * 100.0 if p > 0 else 0.0
            roi = (profit / unit_cost) * 100.0 if unit_cost > 0 else 0.0
            return p, profit, margin, roi, fees, tax, base_fee + trans_fee, fixed_fee
            
        calculated_price = 0.0
        if mode == 1:
            calculated_price = input_value
        elif mode == 2:
            m = input_value / 100.0
            denom = 1.0 - total_rate - m
            if denom > 0:
                p_nocap = (unit_cost + fixed_fee + shipping_cost) / denom
                if (p_nocap * (r_comm + r_service)) > 100.0:
                    denom_cap = 1.0 - r_trans - r_tax - m
                    calculated_price = (unit_cost + 100.0 + fixed_fee + shipping_cost) / denom_cap if denom_cap > 0 else p_nocap
                else:
                    calculated_price = p_nocap
            else:
                calculated_price = 0.0
        elif mode == 3:
            l_rs = input_value
            denom = 1.0 - total_rate
            if denom > 0:
                p_nocap = (unit_cost + fixed_fee + shipping_cost + l_rs) / denom
                if (p_nocap * (r_comm + r_service)) > 100.0:
                    denom_cap = 1.0 - r_trans - r_tax
                    calculated_price = (unit_cost + 100.0 + fixed_fee + shipping_cost + l_rs) / denom_cap if denom_cap > 0 else p_nocap
                else:
                    calculated_price = p_nocap
            else:
                calculated_price = 0.0
                
        # Calculate breakeven
        denom_be = 1.0 - total_rate
        be_nocap = (unit_cost + fixed_fee + shipping_cost) / denom_be if denom_be > 0 else 0.0
        if (be_nocap * (r_comm + r_service)) > 100.0:
            denom_cap = 1.0 - r_trans - r_tax
            breakeven_price = (unit_cost + 100.0 + fixed_fee + shipping_cost) / denom_cap if denom_cap > 0 else be_nocap
        else:
            breakeven_price = be_nocap
            
        calculated_price = round(calculated_price, 2)
        price, net_profit, margin, roi, fees, tax, comm_val, fix_val = eval_shopee_price(calculated_price)
        
        return OnlinePricingResult(
            price=price,
            net_profit=round(net_profit, 2),
            margin=round(margin, 2),
            roi=round(roi, 2),
            breakeven_price=round(breakeven_price, 2),
            marketplace_fees=round(fees, 2),
            shipping_cost=round(shipping_cost, 2),
            tax_cost=round(tax, 2),
            unit_cost=round(unit_cost, 2),
            purchase_cost=purchase_cost,
            packaging_cost=packaging_cost,
            operational_cost=operational_cost,
            commission_percent_val=round(comm_val, 2),
            fixed_fee_val=round(fix_val, 2)
        )

    raise HTTPException(status_code=400, detail="Invalid marketplace")

async def solve_physical_pricing(
    purchase_cost: float,
    packaging_cost: float,
    operational_cost: float,
    tax_rate: float,
    commission_rate: float,
    payment_fee_rate: float,
    mode: int,
    input_value: float
) -> PhysicalPricingResult:
    unit_cost = purchase_cost + packaging_cost + operational_cost
    
    r_tax = tax_rate / 100.0
    r_comm = commission_rate / 100.0
    r_pay = payment_fee_rate / 100.0
    
    total_percent_costs = r_tax + r_comm + r_pay
    
    def solve_price(target_margin: float = 0.0, target_profit: float = 0.0) -> float:
        denom = 1.0 - total_percent_costs - target_margin
        if denom > 0:
            return (unit_cost + target_profit) / denom
        return 0.0
        
    breakeven_price = solve_price()
    
    calculated_price = 0.0
    if mode == 1:
        calculated_price = input_value
    elif mode == 2:
        calculated_price = solve_price(target_margin=input_value/100.0)
    elif mode == 3:
        calculated_price = solve_price(target_profit=input_value)
        
    calculated_price = round(max(calculated_price, 0.01), 2)
    
    tax_cost = calculated_price * r_tax
    commission_cost = calculated_price * r_comm
    payment_fee_cost = calculated_price * r_pay
    
    profit = calculated_price - unit_cost - tax_cost - commission_cost - payment_fee_cost
    margin = (profit / calculated_price) * 100.0 if calculated_price > 0 else 0.0
    roi = (profit / unit_cost) * 100.0 if unit_cost > 0 else 0.0
    
    return PhysicalPricingResult(
        price=calculated_price,
        net_profit=round(profit, 2),
        margin=round(margin, 2),
        roi=round(roi, 2),
        breakeven_price=round(breakeven_price, 2),
        tax_cost=round(tax_cost, 2),
        commission_cost=round(commission_cost, 2),
        payment_fee_cost=round(payment_fee_cost, 2),
        unit_cost=round(unit_cost, 2),
        purchase_cost=purchase_cost,
        packaging_cost=packaging_cost,
        operational_cost=operational_cost
    )

# --- Routes ---

@router.get("/product-cost/{product_id}")
async def get_product_cost(product_id: int, db: Session = Depends(get_db)):
    produto = db.query(Produto).filter(Produto.id == product_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    
    # Calculate PEPS cost
    peps_cost = PEPSService.obter_custo_medio_atual(db, product_id)
    if peps_cost <= 0:
        peps_cost = PEPSService.obter_custo_medio_historico(db, product_id)
    
    # Return cost and other base product fields
    return {
        "id": produto.id,
        "sku": produto.codigo,
        "name": produto.descricao,
        "purchase_cost": peps_cost,
        "selling_price": produto.preco_venda,
        "weight": produto.peso_bruto or 0.2
    }

@router.post("/simulate-online", response_model=OnlinePricingResult)
async def simulate_online_route(request: OnlinePricingRequest, db: Session = Depends(get_db)):
    # 1. Resolve purchase cost
    if request.product_id:
        peps_cost = PEPSService.obter_custo_medio_atual(db, request.product_id)
        if peps_cost <= 0:
            peps_cost = PEPSService.obter_custo_medio_historico(db, request.product_id)
        prod = db.query(Produto).filter(Produto.id == request.product_id).first()
        weight = prod.peso_bruto if prod and prod.peso_bruto else 0.2
    else:
        peps_cost = request.custom_cost if request.custom_cost is not None else 10.0
        weight = 0.2

    res = await solve_online_pricing(
        purchase_cost=peps_cost,
        packaging_cost=request.packaging_cost,
        operational_cost=request.operational_cost,
        tax_rate=request.tax_rate,
        marketplace=request.marketplace,
        mode=request.mode,
        input_value=request.input_value,
        reputation=request.reputation,
        shipping_override=request.shipping_override,
        category=request.category,
        weight=weight
    )
    return res

@router.post("/simulate-physical", response_model=PhysicalPricingResult)
async def simulate_physical_route(request: PhysicalPricingRequest, db: Session = Depends(get_db)):
    # Resolve purchase cost
    if request.product_id:
        peps_cost = PEPSService.obter_custo_medio_atual(db, request.product_id)
        if peps_cost <= 0:
            peps_cost = PEPSService.obter_custo_medio_historico(db, request.product_id)
    else:
        peps_cost = request.custom_cost if request.custom_cost is not None else 10.0

    res = await solve_physical_pricing(
        purchase_cost=peps_cost,
        packaging_cost=request.packaging_cost,
        operational_cost=request.operational_cost,
        tax_rate=request.tax_rate,
        commission_rate=request.commission_rate,
        payment_fee_rate=request.payment_fee_rate,
        mode=request.mode,
        input_value=request.input_value
    )
    return res

@router.post("/compare", response_model=ComparatorResponse)
async def compare_route(request: ComparatorRequest, db: Session = Depends(get_db)):
    product = db.query(Produto).filter(Produto.id == request.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
        
    peps_cost = PEPSService.obter_custo_medio_atual(db, request.product_id)
    if peps_cost <= 0:
        peps_cost = PEPSService.obter_custo_medio_historico(db, request.product_id)
        
    ref_price = request.reference_price if request.reference_price is not None else round(peps_cost * 1.5, 2)
    weight = product.peso_bruto if product.peso_bruto else 0.2
    
    comparisons = []
    
    # 1. ML Classic
    res_classic = await solve_online_pricing(
        purchase_cost=peps_cost,
        packaging_cost=request.packaging_cost_online,
        operational_cost=request.operational_cost_online,
        tax_rate=request.tax_rate_online,
        marketplace="mercado_livre_classic",
        mode=1,
        input_value=ref_price,
        shipping_override=request.shipping_override,
        category=request.category,
        weight=weight
    )
    comparisons.append(ChannelComparisonDetails(
        channel_name="ML Clássico",
        price=res_classic.price,
        fees=res_classic.marketplace_fees,
        shipping=res_classic.shipping_cost,
        tax=res_classic.tax_cost,
        profit=res_classic.net_profit,
        margin=res_classic.margin,
        roi=res_classic.roi
    ))
    
    # 2. ML Premium
    res_premium = await solve_online_pricing(
        purchase_cost=peps_cost,
        packaging_cost=request.packaging_cost_online,
        operational_cost=request.operational_cost_online,
        tax_rate=request.tax_rate_online,
        marketplace="mercado_livre_premium",
        mode=1,
        input_value=ref_price,
        shipping_override=request.shipping_override,
        category=request.category,
        weight=weight
    )
    comparisons.append(ChannelComparisonDetails(
        channel_name="ML Premium",
        price=res_premium.price,
        fees=res_premium.marketplace_fees,
        shipping=res_premium.shipping_cost,
        tax=res_premium.tax_cost,
        profit=res_premium.net_profit,
        margin=res_premium.margin,
        roi=res_premium.roi
    ))
    
    # 3. Shopee
    res_shopee = await solve_online_pricing(
        purchase_cost=peps_cost,
        packaging_cost=request.packaging_cost_online,
        operational_cost=request.operational_cost_online,
        tax_rate=request.tax_rate_online,
        marketplace="shopee",
        mode=1,
        input_value=ref_price,
        shipping_override=request.shipping_override,
        category=request.category,
        weight=weight
    )
    comparisons.append(ChannelComparisonDetails(
        channel_name="Shopee",
        price=res_shopee.price,
        fees=res_shopee.marketplace_fees,
        shipping=res_shopee.shipping_cost,
        tax=res_shopee.tax_cost,
        profit=res_shopee.net_profit,
        margin=res_shopee.margin,
        roi=res_shopee.roi
    ))
    
    # 4. Loja Física
    res_phys = await solve_physical_pricing(
        purchase_cost=peps_cost,
        packaging_cost=request.packaging_cost_physical,
        operational_cost=request.operational_cost_physical,
        tax_rate=request.tax_rate_physical,
        commission_rate=request.commission_rate_physical,
        payment_fee_rate=request.payment_fee_rate_physical,
        mode=1,
        input_value=ref_price
    )
    comparisons.append(ChannelComparisonDetails(
        channel_name="Loja Física",
        price=res_phys.price,
        fees=res_phys.commission_cost + res_phys.payment_fee_cost,
        shipping=0.0,
        tax=res_phys.tax_cost,
        profit=res_phys.net_profit,
        margin=res_phys.margin,
        roi=res_phys.roi
    ))
    
    best_channel = max(comparisons, key=lambda x: x.profit).channel_name
    
    return ComparatorResponse(
        product_name=product.descricao,
        sku=product.codigo,
        unit_cost=peps_cost,
        comparisons=comparisons,
        best_channel=best_channel
    )

@router.post("/smart-pricing", response_model=SmartPricingResponse)
async def smart_pricing_route(request: SmartPricingRequest, db: Session = Depends(get_db)):
    if request.product_id:
        peps_cost = PEPSService.obter_custo_medio_atual(db, request.product_id)
        if peps_cost <= 0:
            peps_cost = PEPSService.obter_custo_medio_historico(db, request.product_id)
        prod = db.query(Produto).filter(Produto.id == request.product_id).first()
        weight = prod.peso_bruto if prod and prod.peso_bruto else 0.2
    else:
        peps_cost = request.custom_cost if request.custom_cost is not None else 10.0
        weight = 0.2

    competitors = [c for c in request.competitors if c > 0]
    
    async def get_online_tiers(marketplace: str) -> List[SmartPricingTier]:
        # Helper inside loop
        async def run_sim(mode: int, val: float):
            return await solve_online_pricing(
                purchase_cost=peps_cost,
                packaging_cost=request.packaging_cost_online,
                operational_cost=request.operational_cost_online,
                tax_rate=request.tax_rate_online,
                marketplace=marketplace,
                mode=mode,
                input_value=val,
                category=request.category,
                weight=weight
            )
            
        # Minimum Strategy (Target 5%)
        res_min = await run_sim(2, 5.0)
        p_min = res_min.price
        min_profit = res_min.net_profit
        min_margin = res_min.margin
        min_roi = res_min.roi
        min_safety = False
        
        if request.min_desired_margin is not None and min_margin < request.min_desired_margin:
            res_safety = await run_sim(2, request.min_desired_margin)
            p_min = res_safety.price
            min_profit = res_safety.net_profit
            min_margin = res_safety.margin
            min_roi = res_safety.roi
            min_safety = True

        # Ideal Strategy (Based on average competitor)
        ideal_safety = False
        if competitors:
            comp_avg = sum(competitors) / len(competitors)
            res_avg = await run_sim(1, comp_avg)
            p_avg_margin = res_avg.margin / 100.0
            if p_avg_margin < 0.15:
                res_ideal = await run_sim(2, 15.0)
            elif p_avg_margin > 0.35:
                res_ideal = await run_sim(2, 30.0)
            else:
                res_ideal = res_avg
        else:
            res_ideal = await run_sim(2, 25.0)
            
        p_ideal = res_ideal.price
        ideal_profit = res_ideal.net_profit
        ideal_margin = res_ideal.margin
        ideal_roi = res_ideal.roi
        
        if request.min_desired_margin is not None and ideal_margin < request.min_desired_margin:
            res_safety = await run_sim(2, request.min_desired_margin)
            p_ideal = res_safety.price
            ideal_profit = res_safety.net_profit
            ideal_margin = res_safety.margin
            ideal_roi = res_safety.roi
            ideal_safety = True

        # Aggressive Strategy
        aggr_safety = False
        if competitors:
            comp_min = min(competitors)
            p_aggr_raw = comp_min - 0.10
            res_aggr_raw = await run_sim(1, p_aggr_raw)
            raw_margin = res_aggr_raw.margin
            
            if request.min_desired_margin is not None and raw_margin < request.min_desired_margin:
                res_safety = await run_sim(2, request.min_desired_margin)
                p_aggr = res_safety.price
                aggr_profit = res_safety.net_profit
                aggr_margin = res_safety.margin
                aggr_roi = res_safety.roi
                aggr_safety = True
            else:
                p_aggr = max(p_min, p_aggr_raw)
                if p_aggr == p_min:
                    p_aggr = p_min
                    aggr_profit = min_profit
                    aggr_margin = min_margin
                    aggr_roi = min_roi
                    aggr_safety = min_safety
                else:
                    res_aggr = await run_sim(1, p_aggr)
                    p_aggr = res_aggr.price
                    aggr_profit = res_aggr.net_profit
                    aggr_margin = res_aggr.margin
                    aggr_roi = res_aggr.roi
        else:
            res_aggr = await run_sim(2, 12.0)
            p_aggr = res_aggr.price
            aggr_profit = res_aggr.net_profit
            aggr_margin = res_aggr.margin
            aggr_roi = res_aggr.roi
            
            if request.min_desired_margin is not None and aggr_margin < request.min_desired_margin:
                res_safety = await run_sim(2, request.min_desired_margin)
                p_aggr = res_safety.price
                aggr_profit = res_safety.net_profit
                aggr_margin = res_safety.margin
                aggr_roi = res_safety.roi
                aggr_safety = True

        return [
            SmartPricingTier(
                strategy="Mínimo",
                price=p_min,
                profit=min_profit,
                margin=min_margin,
                roi=min_roi,
                safety_triggered=min_safety,
                description="Preço defensivo para cobrir custos e garantir margem mínima de segurança (5%)."
            ),
            SmartPricingTier(
                strategy="Ideal",
                price=p_ideal,
                profit=ideal_profit,
                margin=ideal_margin,
                roi=ideal_roi,
                safety_triggered=ideal_safety,
                description="Preço otimizado baseado no comportamento de mercado (concorrência) e margem saudável."
            ),
            SmartPricingTier(
                strategy="Agressivo",
                price=p_aggr,
                profit=aggr_profit,
                margin=aggr_margin,
                roi=aggr_roi,
                safety_triggered=aggr_safety,
                description="Preço de combate para destacar nos rankings de busca e ganhar a Buybox."
            )
        ]

    async def get_physical_tiers() -> List[SmartPricingTier]:
        # Helper inside loop
        async def run_sim(mode: int, val: float):
            return await solve_physical_pricing(
                purchase_cost=peps_cost,
                packaging_cost=request.packaging_cost_physical,
                operational_cost=request.operational_cost_physical,
                tax_rate=request.tax_rate_physical,
                commission_rate=request.commission_rate_physical,
                payment_fee_rate=request.payment_fee_rate_physical,
                mode=mode,
                input_value=val
            )
            
        res_min = await run_sim(2, 5.0)
        p_min = res_min.price
        min_profit = res_min.net_profit
        min_margin = res_min.margin
        min_roi = res_min.roi
        min_safety = False
        
        if request.min_desired_margin is not None and min_margin < request.min_desired_margin:
            res_safety = await run_sim(2, request.min_desired_margin)
            p_min = res_safety.price
            min_profit = res_safety.net_profit
            min_margin = res_safety.margin
            min_roi = res_safety.roi
            min_safety = True

        ideal_safety = False
        if competitors:
            comp_avg = sum(competitors) / len(competitors)
            res_avg = await run_sim(1, comp_avg)
            p_avg_margin = res_avg.margin / 100.0
            if p_avg_margin < 0.15:
                res_ideal = await run_sim(2, 15.0)
            elif p_avg_margin > 0.35:
                res_ideal = await run_sim(2, 30.0)
            else:
                res_ideal = res_avg
        else:
            res_ideal = await run_sim(2, 25.0)
            
        p_ideal = res_ideal.price
        ideal_profit = res_ideal.net_profit
        ideal_margin = res_ideal.margin
        ideal_roi = res_ideal.roi
        
        if request.min_desired_margin is not None and ideal_margin < request.min_desired_margin:
            res_safety = await run_sim(2, request.min_desired_margin)
            p_ideal = res_safety.price
            ideal_profit = res_safety.net_profit
            ideal_margin = res_safety.margin
            ideal_roi = res_safety.roi
            ideal_safety = True

        aggr_safety = False
        if competitors:
            comp_min = min(competitors)
            p_aggr_raw = comp_min - 0.10
            res_aggr_raw = await run_sim(1, p_aggr_raw)
            raw_margin = res_aggr_raw.margin
            
            if request.min_desired_margin is not None and raw_margin < request.min_desired_margin:
                res_safety = await run_sim(2, request.min_desired_margin)
                p_aggr = res_safety.price
                aggr_profit = res_safety.net_profit
                aggr_margin = res_safety.margin
                aggr_roi = res_safety.roi
                aggr_safety = True
            else:
                p_aggr = max(p_min, p_aggr_raw)
                if p_aggr == p_min:
                    p_aggr = p_min
                    aggr_profit = min_profit
                    aggr_margin = min_margin
                    aggr_roi = min_roi
                    aggr_safety = min_safety
                else:
                    res_aggr = await run_sim(1, p_aggr)
                    p_aggr = res_aggr.price
                    aggr_profit = res_aggr.net_profit
                    aggr_margin = res_aggr.margin
                    aggr_roi = res_aggr.roi
        else:
            res_aggr = await run_sim(2, 12.0)
            p_aggr = res_aggr.price
            aggr_profit = res_aggr.net_profit
            aggr_margin = res_aggr.margin
            aggr_roi = res_aggr.roi
            
            if request.min_desired_margin is not None and aggr_margin < request.min_desired_margin:
                res_safety = await run_sim(2, request.min_desired_margin)
                p_aggr = res_safety.price
                aggr_profit = res_safety.net_profit
                aggr_margin = res_safety.margin
                aggr_roi = res_safety.roi
                aggr_safety = True

        return [
            SmartPricingTier(
                strategy="Mínimo",
                price=p_min,
                profit=min_profit,
                margin=min_margin,
                roi=min_roi,
                safety_triggered=min_safety,
                description="Preço defensivo para cobrir custos e garantir margem mínima de segurança (5%)."
            ),
            SmartPricingTier(
                strategy="Ideal",
                price=p_ideal,
                profit=ideal_profit,
                margin=ideal_margin,
                roi=ideal_roi,
                safety_triggered=ideal_safety,
                description="Preço otimizado baseado no comportamento de mercado (concorrência) e margem saudável."
            ),
            SmartPricingTier(
                strategy="Agressivo",
                price=p_aggr,
                profit=aggr_profit,
                margin=aggr_margin,
                roi=aggr_roi,
                safety_triggered=aggr_safety,
                description="Preço de combate para destacar nos rankings de busca e ganhar a Buybox."
            )
        ]

    return SmartPricingResponse(
        mercado_livre_classic=await get_online_tiers("mercado_livre_classic"),
        mercado_livre_premium=await get_online_tiers("mercado_livre_premium"),
        shopee=await get_online_tiers("shopee"),
        loja_fisica=await get_physical_tiers()
    )
