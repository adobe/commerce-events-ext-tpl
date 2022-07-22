/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

var request = require('request');

async function main (params) {
  
    /* print event detail */
    console.log('in main + event detail: ', params.event);
  
    var returnObject = {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: ""
    };
  
    /* handle the challenge */
    if (params.challenge) {
  
      console.log('Returning challenge: ' + params.challenge);
  
      returnObject.body = new Buffer(JSON.stringify({
        "challenge": params.challenge
      })).toString('base64');
  
      return returnObject;
  
    } else {
        // TODO
  
    }
  }
  
  exports.main = main