import { useReducer, useCallback } from 'react';
import { generateId } from '../utils/helpers';

const itemsReducer = (state, action) => {
    switch (action.type) {
        case 'SET_ITEMS':
            return action.payload;
            
        case 'ADD_ITEM':
            return [...state, { id: generateId(), player_name: '', player_number: '', size: '', confirmed: false }];
            
        case 'REMOVE_ITEM': {
            const filtered = state.filter(item => item.id !== action.payload);
            if (filtered.length === 0 || !filtered.some(i => !i.confirmed)) {
                filtered.push({ id: generateId(), player_name: '', player_number: '', size: '', confirmed: false });
            }
            return filtered;
        }
        
        case 'UPDATE_ITEM': {
            const { id, field, value } = action.payload;
            const finalValue = field === 'player_name' ? value.replace(/,/g, '') : value;
            return state.map(item => item.id === id ? { ...item, [field]: finalValue } : item);
        }
        
        case 'CONFIRM_ITEM': {
            const updated = state.map(item => item.id === action.payload ? { ...item, confirmed: true } : item);
            if (!updated.some(i => !i.confirmed)) {
                updated.push({ id: generateId(), player_name: '', player_number: '', size: '', confirmed: false });
            }
            return updated;
        }
        
        case 'EDIT_ITEM':
            return state.map(item => item.id === action.payload.id ? action.payload : item);
            
        default:
            return state;
    }
};

export const useOrderItems = (initialItems = []) => {
    const [items, dispatch] = useReducer(itemsReducer, initialItems);

    const setItems = useCallback((newItems) => dispatch({ type: 'SET_ITEMS', payload: newItems }), []);
    const removeItem = useCallback((id) => dispatch({ type: 'REMOVE_ITEM', payload: id }), []);
    const updateItem = useCallback((id, field, value) => dispatch({ type: 'UPDATE_ITEM', payload: { id, field, value } }), []);
    const confirmItem = useCallback((id) => dispatch({ type: 'CONFIRM_ITEM', payload: id }), []);
    const saveEditedItem = useCallback((editedItem) => dispatch({ type: 'EDIT_ITEM', payload: editedItem }), []);

    return { items, setItems, removeItem, updateItem, confirmItem, saveEditedItem };
};