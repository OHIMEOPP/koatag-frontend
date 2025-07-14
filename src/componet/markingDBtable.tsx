import React, { Component, useRef, useState, useEffect } from "react";
import "../App.css";
import axios from "axios";

interface MarkingTableProps {
  marDBcolumnsArray: string;  // 或更精確的型別
}
interface Tags {
  tag_name: string;  // 或更精確的型別
}
function MarkingTable({ marDBcolumnsArray }: MarkingTableProps) {
// function MarkingTable({ marDBcolumnsArray }) {
    console.log(marDBcolumnsArray);
    const mar = [
        'id', 'lot_code', 'plate', 'entered_at', 'counted_at',
        'exited_at', 'overdue_from', 'paid_by', 'paid_at',
        'parking_hour', 'local_id', 'acl_id', 'reservation_id',
        'transacation_id', 'enter_record_id', 'state', 'category',
        'origin_fee', 'actual_fee', 'receive_discount_hour', 'used_discount_hour',
        'invoice_number', 'extra_info', 'created_at', 'updated_at', 'ticket_uid'];
    const marChin = [
        '停車序號', '折扣設備', '車牌號碼', '入車時間', '計時時間?', '出車時間', '從何時愈期?', '付款人?', '付款時間',
        '實際停車', '本地編號', '存取控制列表編號?', '預約編號?', '交易編號', '輸入記錄編號', '狀態', '類別', '原始費用', '實際費用',
        '折扣時數', '使用折扣時數', '發票號碼', '額外資訊', '創建時間', '更新時間', '票務uid'
    ];
    const [tags, setTags] = useState<Tags[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        axios.post("http://26.205.165.161:1900/getTagByType", {
            fields: '髮色',
            colume: 'type',
            user_id: 1
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => {
                setTags(response.data);
            })
            .catch(err => {
                console.error('error: find tag is fail -> ', err);
                setError('取得標籤失敗');
            });
    }, []);


    return <>
        <table>
            <thead>
                {mar.map((e, index) => {
                    return <tr key={index}><td >{e}</td><td>{marChin[index]}</td></tr>
                })}
            </thead>
            <tbody>

            </tbody>
        </table>
        {tags.map((element, index) => (
            <div><a
                key={index}
                href={`http://26.205.165.161:8123/main/image_area?page=1&tag=${encodeURIComponent(element.tag_name)}`}
                draggable="true"
            >
                {element.tag_name}
            </a></div>
        ))}
    </>
}

export default MarkingTable;