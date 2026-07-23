import os
import json
import time
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# ============ DATA ============
def load_data(filename):
    try:
        with open(f'data/{filename}', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return []

def save_data(filename, data):
    os.makedirs('data', exist_ok=True)
    with open(f'data/{filename}', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def find_user(user_id):
    users = load_data('users.json')
    for u in users:
        if u['id'] == user_id:
            return u
    return None

# ============ API ============
@app.route('/')
def home():
    return jsonify({'status': 'ok', 'message': 'API is running'})

@app.route('/api/auth', methods=['POST'])
def auth():
    data = request.json
    init_data = data.get('initData')
    if not init_data:
        return jsonify({'error': 'No init data'}), 401
    try:
        import urllib.parse
        params = {}
        for item in init_data.split('&'):
            if '=' in item:
                key, value = item.split('=', 1)
                params[key] = value
        if 'user' in params:
            user_data = json.loads(urllib.parse.unquote(params['user']))
            user_id = str(user_data.get('id'))
            existing = find_user(user_id)
            if not existing:
                new_user = {
                    'id': user_id,
                    'username': user_data.get('username', ''),
                    'first_name': user_data.get('first_name', ''),
                    'last_name': user_data.get('last_name', ''),
                    'role': 'customer',
                    'balance': 0,
                    'total_recharge': 0,
                    'total_spent': 0,
                    'commission_rate': 10,
                    'commission_earned': 0,
                    'referred_by': None,
                    'referrals': [],
                    'created_at': datetime.now().isoformat()
                }
                users = load_data('users.json')
                users.append(new_user)
                save_data('users.json', users)
                existing = new_user
            return jsonify({'success': True, 'user': existing})
    except Exception as e:
        return jsonify({'error': str(e)}), 401
    return jsonify({'error': 'Invalid auth'}), 401

@app.route('/api/products', methods=['GET'])
def get_products():
    products = load_data('products.json')
    return jsonify(products)

@app.route('/api/user/<user_id>', methods=['GET'])
def get_user(user_id):
    user = find_user(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user)

@app.route('/api/recharge', methods=['POST'])
def recharge():
    data = request.json
    user_id = data.get('userId')
    amount = data.get('amount', 0)
    if amount <= 0:
        return jsonify({'error': 'Invalid amount'}), 400
    users = load_data('users.json')
    user = None
    for u in users:
        if u['id'] == user_id:
            user = u
            break
    if not user:
        return jsonify({'error': 'User not found'}), 404
    user['balance'] += amount
    user['total_recharge'] += amount
    for i, u in enumerate(users):
        if u['id'] == user_id:
            users[i] = user
            break
    save_data('users.json', users)
    return jsonify({'success': True, 'user': user})

@app.route('/api/buy', methods=['POST'])
def buy():
    data = request.json
    user_id = data.get('userId')
    product_id = data.get('productId')
    quantity = data.get('quantity', 1)
    user = find_user(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    products = load_data('products.json')
    product = None
    for p in products:
        if p['id'] == product_id:
            product = p
            break
    if not product:
        return jsonify({'error': 'Product not found'}), 404
    price = product.get('reseller_price', product.get('price', 0))
    total = price * quantity
    if user['balance'] < total:
        return jsonify({'error': 'Insufficient balance'}), 400
    keys = load_data('keys.json')
    purchased_keys = []
    for _ in range(quantity):
        for k in keys:
            if k['product_id'] == product_id and k['status'] == 'available':
                k['status'] = 'sold'
                k['buyer'] = user_id
                k['sold_at'] = datetime.now().isoformat()
                purchased_keys.append(k['code'])
                break
    if len(purchased_keys) < quantity:
        return jsonify({'error': 'Not enough keys'}), 400
    user['balance'] -= total
    user['total_spent'] += total
    users = load_data('users.json')
    for i, u in enumerate(users):
        if u['id'] == user_id:
            users[i] = user
            break
    save_data('users.json', users)
    save_data('keys.json', keys)
    orders = load_data('orders.json')
    orders.append({
        'id': f"ORD_{int(time.time())}",
        'user_id': user_id,
        'product_id': product_id,
        'product_name': product.get('name', ''),
        'quantity': quantity,
        'total': total,
        'keys': purchased_keys,
        'created_at': datetime.now().isoformat()
    })
    save_data('orders.json', orders)
    return jsonify({'success': True, 'keys': purchased_keys, 'balance': user['balance']})

@app.route('/api/orders/<user_id>', methods=['GET'])
def get_orders(user_id):
    orders = load_data('orders.json')
    user_orders = [o for o in orders if o['user_id'] == user_id]
    return jsonify(user_orders)

@app.route('/api/top/<filter_type>', methods=['GET'])
def get_top(filter_type):
    users = load_data('users.json')
    sorted_users = sorted(users, key=lambda x: x.get('total_recharge', 0), reverse=True)
    return jsonify(sorted_users[:10])

if __name__ == '__main__':
    app.run(debug=True, port=5000)
