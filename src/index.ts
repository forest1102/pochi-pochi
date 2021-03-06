import * as path from 'path'
import * as express from 'express'
import { execSync } from 'child_process'
import { exec, spawn } from 'child-process-promise'
import * as admin from 'firebase-admin'
import {v1 as uuidv1} from 'uuid'
const serviceAccount = require('../config/serviceAccount.json')
const app = express()
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://pochi-pochi.firebaseio.com"
})

const db        = admin.database()
const codesRef  = db.ref('codes')
const actionRef = db.ref('action')
let isInit      = true

class IRCodesObj {
  data=new  Map<string,IRCode>()
  private static _instance: IRCodesObj
  private constructor() {
    const _this=this
    codesRef
      .on('child_added',(snapshot,prevKey) => {
        _this.set(snapshot.key,snapshot.val())
      })
    codesRef  
      .on('child_changed',snapshot=>{
        _this.set(snapshot.key,snapshot.val())
      })
    codesRef
      .on('child_removed',snapshot=>{
        _this.data.delete(snapshot.key)
      })
  }
  public static get instance(): IRCodesObj {
    if (!this._instance) {
      this._instance = new IRCodesObj()
    }
    return this._instance
  }
  
  set(phrase:string,code:string){
    const ir=new IRCode(phrase,code)
    
    this.data.set(phrase,ir)
    return {[phrase]:ir}
  }

  find(phrase: string): IRCode{
    return this.data.get(phrase)
  }

}

const codes = IRCodesObj.instance

class IRCode {
  code: string
  phrase: string

  static codeFrom(memo_no: number): string {
    return execSync(`python python/remocon.py r ${memo_no}`).toString()
  }

  constructor(_phrase: string, codeOrNum?: number | string) {
    this.phrase = _phrase
    if (typeof codeOrNum === 'number') {
      this.code = IRCode.codeFrom(codeOrNum)
    }
    else if (typeof codeOrNum === 'string') {
      this.code = codeOrNum
    }
    console.log(this.phrase,':', this.code)
  }

  execCode() {
    console.log(`${this.code} is transed`)
    return exec(`python python/remocon.py t ${this.code}`)
      .then(({ stdout, stderr }: { stdout: string, stderr: string }) =>
        new Promise<string>((resolve, reject) => {
          resolve(stdout)
        })
      )
  }
  static execCode(code: string) {
    console.log(`${code} is transed`)
    return exec(`python python/remocon.py t ${code}`)
      .then(({ stdout, stderr }: { stdout: string, stderr: string }) =>
        new Promise<string>((resolve, reject) => {
          resolve(stdout)
        })
      )
  }
  get zipped() {
    return { [this.phrase]: this.code }
  }
  get rawDict() {
    return {
      'phrase': this.phrase,
      'code': this.code
    }
  }
}

app

  .get('/codes', (req, res) =>{
    console.log(codes.data)  
    return res.json(Array.from(codes.data))
  })

  .put('/addcode', (req, res) => {
    const { phrase, code } = req.query
    const irCode = new IRCode(phrase, code)
    return codesRef
      .update(irCode.zipped)
      .then(() => {
        return res.json(irCode.zipped)
      })
  })

  .get('/code-from/:memo_no', (req, res) => {
    const memo_no = +req.params.memo_no
    return res.send(IRCode.codeFrom(memo_no))
  })

  .put('/addcode-from/:id', (req, res) => {
    const phrase = String(req.query.phrase),
      memo_no = +req.params.id,
      ir = new IRCode(phrase, memo_no)
    console.log(phrase, memo_no)
    return codesRef
      .update(ir.zipped)
      .then(() => res.send(ir.zipped))
  })
  .put('/request', (req, res) => {
    const { phrase } = req.query,
      id=uuidv1()
    
    if (!phrase) {
      return res.status(400)
    }

    return actionRef.update({phrase,id})
      .then(() => res.send(phrase))
  })
// 
// .post('/code',(req,res)=>{
// 
// })
// 



actionRef.on('value', snapshot => {
  if (isInit) {
    isInit = false
    return
  }

  const { phrase } = snapshot.val()
  if (!phrase) {
    return
  }

  const ir=codes.find(phrase)
  
  if(!ir){
    return
  }
  
  ir.execCode()  
})

const server = app.listen(3000, function() {
  console.log("Node.js is listening to PORT:" + server.address().port);
})


