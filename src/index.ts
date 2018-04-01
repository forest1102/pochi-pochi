import * as path from 'path'
import * as express from 'express'
import {exec,spawn} from 'child-process-promise'
import * as admin from 'firebase-admin'
const serviceAccount = require('../config/pochi-pochi-firebase-adminsdk-eplb1-cbfc364ec8.json')
const app = express()
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://pochi-pochi.firebaseio.com"
})

const db=admin.database()
const codesRef=db.ref('codes')
const actionRef=db.ref('action')
let isInit=true
class IRCodesObj{
  data:Object
  private static _instance:IRCodesObj
  private constructor(){
    console.log('constructor was called!')
    codesRef.on('value',snapshot=>{
      this.data=snapshot.val()
      console.log(this.data)
    })
  }
  public static get instance():IRCodesObj{
    if(!this._instance){
      this._instance=new IRCodesObj()
    }
    return this._instance
  }
  
  find(phrase:string):string{
    return this.data[phrase]
  }
  
}

const codes=IRCodesObj.instance

class IRCode {
  code:string
  phrase:string
  
  static codeFrom(memo_no:number):Promise<string>{
    return exec(`python python/remocon.py r ${memo_no}`)
      .then(({stdout,stderr}:{stdout:string,stderr:string})=>
        new Promise<string>((resolve,reject)=>{
          resolve(stdout) 
        })
      )
  }
  
  constructor(_phrase:string,codeOrNum?:number|string){
    this.phrase=_phrase
    if(typeof codeOrNum==='number'){
      IRCode.codeFrom(codeOrNum)
        .then(code=>{
          this.code=code
        })
        
    }
    if(typeof codeOrNum==='string'){
      this.code=codeOrNum
    }
  }
  
  execCode(){
    console.log(`${this.code} is transed`)
    return exec(`python python/remocon.py t ${this.code}`)
      .then(({stdout,stderr}:{stdout:string,stderr:string})=>
        new Promise<string>((resolve,reject)=>{
          resolve(stdout) 
        })
      )
  }
  static execCode(code:string){
    console.log(`${code} is transed`)
    return exec(`python python/remocon.py t ${code}`)
      .then(({stdout,stderr}:{stdout:string,stderr:string})=>
        new Promise<string>((resolve,reject)=>{
          resolve(stdout) 
        })
    )
  }
  get zipped(){
    return {[this.phrase]:this.code}
  }
  get rawDict(){
    return {
      'phrase':this.phrase,
      'code'  :this.code
    }
  }
}

app

  .get('/codes',(req,res)=>
    res.json(codes.data)
  )
  
  .put('/addcode',(req,res)=>{
    const {phrase,code}=req.query
    const irCode=new IRCode(phrase,code)
    return codesRef
      .update(irCode.zipped)
      .then(()=>{
        return res.json(irCode.zipped)
      })
  })

  .get('/code-from/:memo_no',(req,res)=>{
    const memo_no=+req.params.memo_no
    return IRCode.codeFrom(memo_no)
      .then(result => {
        console.log(result)
        return res.send(result) 
      })
  })

  .put('/addcode-from/:id',(req,res)=> {
    const phrase:string=req.query.phrase,
      memo_no=+req.params.id,
      ir=new IRCode(phrase,memo_no)
    return codesRef
      .update(ir.zipped)
      .then(()=> res.send(ir.zipped))
  })
  .put('/request',(req,res)=>{
    const action=req.query
    if(action===null){
      return
    }
    if('code' in action){
      IRCode.execCode(action['code'])
    }
    else if('phrase' in action){
      IRCode.execCode(codes.find(action['phrase']))
    }
  })
// 
// .post('/code',(req,res)=>{
// 
// })
// 



actionRef.on('value',snapshot=>{
  if(isInit){
    isInit=false
    return
  }
  
  const action:Object=snapshot.val()
  
  if(action===null){
    return
  }
  if('code' in action){
    IRCode.execCode(action['code'])
  }
  else if('phrase' in action){
    IRCode.execCode(codes.find(action['phrase']))
  }
})

const server = app.listen(3000, function(){
  console.log("Node.js is listening to PORT:" + server.address().port);
})


