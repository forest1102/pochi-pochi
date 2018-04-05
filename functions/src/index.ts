import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'
import {v1 as uuidv1} from 'uuid'

admin.initializeApp(functions.config().firebase)

const db        = admin.database()
const codesRef  = db.ref('codes')
const actionRef = db.ref('action')

export const execCode= functions.https.onRequest((req, res) => {
    const { phrase } = req.query,
      id=uuidv1()
    
    if (!phrase) {
      return res.status(400)
    }

    return actionRef.update({phrase,id})
      .then(() => res.send(phrase))
  }) 
