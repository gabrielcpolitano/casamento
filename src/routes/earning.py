from flask import Blueprint, jsonify, request
from flask_socketio import emit
from src.models.earning import Earning, db
from datetime import datetime

earning_bp = Blueprint('earning', __name__)

@earning_bp.route('/earnings', methods=['GET'])
def get_earnings():
    """Get all earnings"""
    earnings = Earning.query.order_by(Earning.data.desc()).all()
    return jsonify([earning.to_dict() for earning in earnings])

@earning_bp.route('/earnings', methods=['POST'])
def create_earning():
    """Create a new earning"""
    try:
        data = request.json
        
        # Parse the date string to a date object
        data_str = data.get('data')
        if data_str:
            data_date = datetime.strptime(data_str, '%Y-%m-%d').date()
        else:
            data_date = datetime.now().date()
        
        earning = Earning(
            valor=float(data.get('valor', 0)),
            descricao=data.get('descricao', ''),
            data=data_date
        )
        
        db.session.add(earning)
        db.session.commit()
        
        earning_dict = earning.to_dict()
        
        # Emit real-time update to all connected clients
        from src.main import socketio
        socketio.emit('earning_added', earning_dict)
        
        return jsonify(earning_dict), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@earning_bp.route('/earnings/<int:earning_id>', methods=['GET'])
def get_earning(earning_id):
    """Get a specific earning"""
    earning = Earning.query.get_or_404(earning_id)
    return jsonify(earning.to_dict())

@earning_bp.route('/earnings/<int:earning_id>', methods=['PUT'])
def update_earning(earning_id):
    """Update an earning"""
    try:
        earning = Earning.query.get_or_404(earning_id)
        data = request.json
        
        earning.valor = float(data.get('valor', earning.valor))
        earning.descricao = data.get('descricao', earning.descricao)
        
        if data.get('data'):
            earning.data = datetime.strptime(data['data'], '%Y-%m-%d').date()
        
        earning.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        earning_dict = earning.to_dict()
        
        # Emit real-time update to all connected clients
        from src.main import socketio
        socketio.emit('earning_updated', earning_dict)
        
        return jsonify(earning_dict)
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@earning_bp.route('/earnings/<int:earning_id>', methods=['DELETE'])
def delete_earning(earning_id):
    """Delete an earning"""
    try:
        earning = Earning.query.get_or_404(earning_id)
        earning_dict = earning.to_dict()
        
        db.session.delete(earning)
        db.session.commit()
        
        # Emit real-time update to all connected clients
        from src.main import socketio
        socketio.emit('earning_deleted', earning_dict)
        
        return '', 204
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@earning_bp.route('/earnings/clear', methods=['DELETE'])
def clear_all_earnings():
    """Clear all earnings"""
    try:
        Earning.query.delete()
        db.session.commit()
        
        # Emit real-time update to all connected clients
        from src.main import socketio
        socketio.emit('earnings_cleared', {})
        
        return jsonify({'message': 'All earnings cleared'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@earning_bp.route('/earnings/stats', methods=['GET'])
def get_earnings_stats():
    """Get earnings statistics"""
    try:
        earnings = Earning.query.all()
        total = sum(earning.valor for earning in earnings)
        count = len(earnings)
        
        return jsonify({
            'total': total,
            'count': count,
            'average': total / count if count > 0 else 0
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

